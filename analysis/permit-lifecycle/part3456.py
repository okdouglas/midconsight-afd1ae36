import sys, json, pickle
sys.path.insert(0, '/tmp/claude-0/-home-claude-midconsight-afd1ae36/74a26e63-918d-5e82-a5ab-dc2fe498447b/scratchpad/stats')
from part12 import *
from statsmodels.duration.hazard_regression import PHReg

res = json.load(open(OUT + '_res12.json'))
groups = d['op'].values

# ================= Part 3: Cox =================
d['hh'] = (d.drill == 'HH').astype(float)
d['unk'] = (d.drill == '?').astype(float)
d['top25'] = (d['size'] == 'top25 operators').astype(float)
yrs = [2020, 2021, 2022, 2023, 2024]
for y in yrs:
    d[f'y{y}'] = (d.yr == y).astype(float)
d['y2025p'] = (d.yr >= 2025).astype(float)
COV = ['hh', 'unk', 'top25'] + [f'y{y}' for y in yrs] + ['y2025p']
LAB = {'hh': 'Horizontal vs straight/directional', 'unk': 'Unknown drill type vs straight/directional',
       'top25': 'Top-25 operator vs other', 'y2025p': 'Approved 2025-2026 vs 2019'}
for y in yrs:
    LAB[f'y{y}'] = f'Approved {y} vs 2019'
tfp, efp = tk(d, 'fp', 'l_fp')
tfp_eff = np.maximum(tfp, 0.5)
d['tfp'] = tfp_eff; d['efp'] = efp


def cox(df, cov=COV, strata=None, entry=None, label=''):
    X = df[cov].values
    mod = PHReg(df['tfp'].values, X, status=df['efp'].values, entry=entry, strata=strata, ties='breslow')
    r_m = mod.fit(disp=False)
    r_r = mod.fit(groups=df['op'].values, disp=False)
    b = r_m.params
    out = dict(n=int(len(df)), events=int(df['efp'].sum()), terms={})
    for i, c in enumerate(cov):
        se_m = float(r_m.bse[i]); se_r = float(r_r.bse[i])
        out['terms'][c] = dict(label=LAB.get(c, c), coef=float(b[i]), HR=float(np.exp(b[i])),
                               se_model=se_m, se_cluster=se_r,
                               HR_ci_model=[float(np.exp(b[i] - Z95 * se_m)), float(np.exp(b[i] + Z95 * se_m))],
                               HR_ci_cluster=[float(np.exp(b[i] - Z95 * se_r)), float(np.exp(b[i] + Z95 * se_r))],
                               p_cluster=float(2 * stats.norm.sf(abs(b[i] / se_r))))
    out['loglik'] = float(r_m.llf)
    return out, mod, r_m


def gt_test(df, mod, r_m, cov=COV):
    """Grambsch-Therneau score test of proportional hazards. g(t) = rank(t) or log t."""
    R = np.asarray(r_m.schoenfeld_residuals)
    ev = df['efp'].values == 1
    R = R[ev]; te = df['tfp'].values[ev]
    ok = ~np.isnan(R).any(axis=1)
    R = R[ok]; te = te[ok]
    V = np.asarray(r_m.cov_params())
    dd = R.shape[0]
    out = {}
    for gname, g in [('rank', stats.rankdata(te)), ('log_t', np.log(te))]:
        xx = g - g.mean()
        U = xx @ R
        VU = V @ U
        Sxx = (xx ** 2).sum()
        per = dd * VU ** 2 / (np.diag(V) * Sxx)
        glob = dd * U @ V @ U / Sxx
        out[gname] = dict(global_chi2=float(glob), global_df=len(cov), global_p=float(stats.chi2.sf(glob, len(cov))),
                          per_term={c: dict(chi2=float(per[i]), p=float(stats.chi2.sf(per[i], 1))) for i, c in enumerate(cov)})
    return out


cox_res = {}
c_full, mod, r_m = cox(d)
c_full['schoenfeld'] = gt_test(d, mod, r_m)
cox_res['full'] = c_full
# truncated at 730 (administrative censoring)
d730 = d.copy()
over = d730.tfp > 730
d730.loc[over, 'tfp'] = 730; d730.loc[over, 'efp'] = 0
c730, mod7, r7 = cox(d730)
c730['schoenfeld'] = gt_test(d730, mod7, r7)
cox_res['trunc730'] = c730
# stratified by drill type
cs, mods, rs = cox(d, cov=[c for c in COV if c not in ('hh', 'unk')], strata=d['drill'].values)
cs['schoenfeld'] = gt_test(d, mods, rs, [c for c in COV if c not in ('hh', 'unk')]) if False else None
cox_res['strat_drill'] = cs
# stratified by drill and year (top25 only)
cox_res['windows'] = {}
for (a, b_) in [(0, 120), (120, 365), (365, 1e9)]:
    sub = d[d.tfp > a].copy()
    ov = sub.tfp > b_
    sub.loc[ov, 'tfp'] = b_; sub.loc[ov, 'efp'] = 0
    cw, _, _ = cox(sub, cov=['hh', 'unk', 'top25'] + [f'y{y}' for y in yrs] + ['y2025p'], entry=np.full(len(sub), float(a)))
    cox_res['windows'][f'{a}-{int(b_) if b_ < 1e8 else "inf"}'] = cw
res['cox'] = cox_res
print('Cox global PH', c_full['schoenfeld']['rank']['global_p'], c_full['schoenfeld']['log_t']['global_p'])
for c in COV:
    print(c, round(c_full['terms'][c]['HR'], 3), round(c_full['schoenfeld']['rank']['per_term'][c]['p'], 4))

# ---- Mixture-cure log-logistic with covariates (AFT for the susceptible, logit for cure) ----
yg = lambda lo, hi: ((d.yr >= lo) & (d.yr <= hi)).astype(float).values
Xc = np.column_stack([np.ones(len(d)), d.hh, d.unk, d.top25, yg(2020, 2020), yg(2021, 2021), yg(2022, 2022), yg(2023, 2023), yg(2024, 2024), yg(2025, 2026)])
names = ['intercept', 'hh', 'unk', 'top25', 'y2020', 'y2021', 'y2022', 'y2023', 'y2024', 'y2025p']
kind_fp = efp.copy()
mc = CureModel('loglogistic', tfp, kind_fp, Xc, Xc, groups)
st = mc.start()
mc.groups = groups
mcf = mc.fit()
th = mcf.th
kp = Xc.shape[1]
cc = dict(ll=float(mcf.ll), aic=float(mcf.aic), bic=float(mcf.bic), k=int(mcf.k), shape_b=float(np.exp(th[-1])),
          shape_b_se_cl=delta_se(lambda x: np.exp(x[-1]), th, mcf.Vr), cure_logit={}, time_ratio={})
for i, nm in enumerate(names):
    se_n = float(np.sqrt(mcf.Vn[i, i])); se_r = float(np.sqrt(mcf.Vr[i, i]))
    cc['cure_logit'][nm] = dict(coef=float(th[i]), odds_ratio_never=float(np.exp(th[i])), se_model=se_n, se_cluster=se_r,
                                or_ci_cluster=[float(np.exp(th[i] - Z95 * se_r)), float(np.exp(th[i] + Z95 * se_r))])
    j = kp + i
    se_n = float(np.sqrt(mcf.Vn[j, j])); se_r = float(np.sqrt(mcf.Vr[j, j]))
    cc['time_ratio'][nm] = dict(coef=float(th[j]), time_ratio=float(np.exp(th[j])), se_model=se_n, se_cluster=se_r,
                                tr_ci_cluster=[float(np.exp(th[j] - Z95 * se_r)), float(np.exp(th[j] + Z95 * se_r))])
res['cure_cov'] = cc
print('cure-cov done', cc['aic'])

# ================= Part 4/5: weight curves =================
kfp = {dt: km(*tk(d if dt == 'ALL' else d[d.drill == dt], 'fp', 'l_fp')) for dt in ['HH', 'SH', '?', 'ALL']}
W0 = 0.5 ** (GRID / 60.0)


def w_cf(p, t):
    c, a, b = p
    return c + (1 - c) / (1 + (np.maximum(t, 0) / a) ** b)


def w_exp(p, t):
    c, h = p
    return c + (1 - c) * 0.5 ** (t / h)


res['weights'] = {}
curves = {}
for dt in ['HH', 'SH', '?', 'ALL']:
    Sk = km_at(kfp[dt], GRID)
    o = res['cure'][dt]['loglogistic']
    mle = (o['pi'], o['scale_a'], o['shape_b'])
    f = lambda p: w_cf(p, GRID) - Sk
    r = optimize.least_squares(f, mle, bounds=([0, 1, 0.3], [1, 2000, 20]))
    cf = r.x
    f2 = lambda p: w_exp(p, GRID) - Sk
    r2 = optimize.least_squares(f2, [0.2, 100], bounds=([0, 1], [1, 2000]))
    ex = r2.x
    ar = atrisk_at(np.where(d[d.drill == dt].fp.notna() if dt != 'ALL' else d.fp.notna(), (d[d.drill == dt] if dt != 'ALL' else d).l_fp, (d[d.drill == dt] if dt != 'ALL' else d).follow), GRID)
    Smle = w_cf(mle, GRID)
    Scf = w_cf(cf, GRID); Sex = w_exp(ex, GRID)
    auc = lambda y: float(np.trapezoid(y, GRID))
    m = lambda a: dict(max_abs_err=float(np.abs(a - Sk).max()), t_at_max=int(GRID[np.argmax(np.abs(a - Sk))]),
                       rmse=float(np.sqrt(((a - Sk) ** 2).mean())), auc_diff_days=auc(a - Sk))
    rec = dict(
        km_auc_days_0_730=auc(Sk),
        closed_form_mle=dict(c=mle[0], a=mle[1], b=mle[2], **m(Smle)),
        closed_form_ls=dict(c=float(cf[0]), a=float(cf[1]), b=float(cf[2]), **m(Scf)),
        exp_floor_ls=dict(c=float(ex[0]), halflife=float(ex[1]), **m(Sex)),
        current_w=dict(**m(W0), rmse_0_365=float(np.sqrt(((W0 - Sk)[:366] ** 2).mean())), w_at={str(x): float(W0[x]) for x in [30, 60, 120, 180, 365, 730]}),
        km_at={str(x): float(Sk[x]) for x in [30, 60, 120, 180, 365, 540, 730]},
        ls_at={str(x): float(Scf[x]) for x in [30, 60, 120, 180, 365, 540, 730]},
    )
    rec['current_w']['auc_w_days'] = auc(W0)
    rec['current_w']['auc_ratio_w_over_km'] = auc(W0) / auc(Sk)
    # first crossing of KM below 0.5
    below = np.where(Sk <= 0.5)[0]
    rec['km_t_S_half'] = int(GRID[below[0]]) if len(below) else None
    res['weights'][dt] = rec
    curves[dt] = dict(Sk=Sk, Smle=Smle, Scf=Scf, Sex=Sex)
    print(dt, 'cf', cf.round(3), 'maxerr', rec['closed_form_ls']['max_abs_err'], 'curr rmse', rec['current_w']['rmse'])
pickle.dump(curves, open(OUT + '_curves.pkl', 'wb'))

# ================= Part 6: sensitivity =================
d['known_fail'] = d.spud.notna() & d.fp.isna() & ((d.follow - d.l_spud.fillna(0)) >= 365)
res['n_known_fail_spud_nofp_ge365d'] = int(d.known_fail.sum())
d['ac_nospud'] = d.spud.isna() & (d.status == 'AC')
res['n_AC_no_spud'] = int(d.ac_nospud.sum())
scen = {
    'base': d,
    'approved_2021_2024': d[(d.yr >= 2021) & (d.yr <= 2024)],
    'drop_EX': d[d.status != 'EX'],
    'drop_ND_EX_NE': d[~d.status.isin(['EX', 'ND', 'NE'])],
    'drop_AC_without_spud_date': d[~d.ac_nospud],
    'spud_nofp_failed_after_365d': d,
}
sens = {}
for sn, df in scen.items():
    sens[sn] = {}
    for dt in ['HH', 'SH', 'ALL']:
        sub = df if dt == 'ALL' else df[df.drill == dt]
        t, e = tk(sub, 'fp', 'l_fp')
        kind = e.copy()
        tk_ = t.copy(); ek = e.copy()
        if sn == 'spud_nofp_failed_after_365d':
            kf = sub.known_fail.values
            kind = np.where(kf, -1, e)
            tk_ = np.where(kf, 1e9, t)
        k = km(tk_, ek)
        S365 = float(km_at(k, np.array([365]))[0]); S730 = float(km_at(k, np.array([730]))[0])
        mdl = {}
        for fam in ['loglogistic']:
            m_ = CureModel(fam, t, kind, np.ones((len(t), 1)), np.ones((len(t), 1)), sub['op'].values).fit()
            th = m_.th
            pif = lambda x: expit(x[0]); med = lambda x: np.exp(x[1])
            mdl = dict(pi=float(pif(th)), pi_se_cl=delta_se(pif, th, m_.Vr), median_susceptible=float(med(th)),
                       median_susceptible_se_cl=delta_se(med, th, m_.Vr), shape_b=float(np.exp(th[2])))
        # nonparametric: time when CI reaches half of CI(730)
        ci = 1 - km_at(k, GRID)
        half = np.where(ci >= ci[730] / 2)[0][0]
        sens[sn][dt] = dict(n=int(len(sub)), n_producers=int(e.sum()),
                            raw_median_days_among_observed_producers=float(np.median(t[e == 1])),
                            km_half_of_CI730_days=int(half), CI_365=1 - S365, CI_730=1 - S730,
                            cure_loglogistic=mdl)
        print(sn, dt, round(1 - S365, 3), round(mdl['pi'], 3), round(mdl['median_susceptible'], 1))
res['sensitivity'] = sens
res['sens_notes'] = ('spud_nofp_failed_after_365d: wells with a spud date, no first production, and >=365 days since spud are treated as '
                     'known never-producers (KM: never censored, stay in risk set; cure model: contribute log pi). Base case censors them at follow.')
json.dump(res, open(OUT + '_res_all.json', 'w'), indent=1, default=float)
