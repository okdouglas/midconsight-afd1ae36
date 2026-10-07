import sys, json, pickle
sys.path.insert(0, '/tmp/claude-0/-home-claude-midconsight-afd1ae36/74a26e63-918d-5e82-a5ab-dc2fe498447b/scratchpad/stats')
from lib import *

OUT = '/tmp/claude-0/-home-claude-midconsight-afd1ae36/74a26e63-918d-5e82-a5ab-dc2fe498447b/scratchpad/stats/'
d = pd.read_pickle('/tmp/claude-0/-home-claude-midconsight-afd1ae36/74a26e63-918d-5e82-a5ab-dc2fe498447b/scratchpad/work/cohort2.pkl')
d = d.reset_index(drop=True)
d['T'] = d['follow'].astype(float)
FAM = ['loglogistic', 'weibull', 'lognormal']


def tk(df, col, lcol):
    ev = df[col].notna().values
    t = np.where(ev, df[lcol].values, df['follow'].values).astype(float)
    return t, ev.astype(int)


def fit_cure(fam, t, kind, groups=None):
    m = CureModel(fam, t, kind, np.ones((len(t), 1)), np.ones((len(t), 1)), groups).fit()
    th = m.th; V = m.Vr; Vn = m.Vn
    pif = lambda x: expit(x[0]); sc = lambda x: np.exp(x[1]); sh = lambda x: np.exp(x[2])
    loc = lambda x: x[1]
    out = dict(family=fam, n=int(m.n), n_events=int((kind == 1).sum()), ll=float(m.ll), k=3,
               aic=float(m.aic), bic=float(m.bic))
    out['pi'] = float(pif(th)); out['pi_se'] = delta_se(pif, th, Vn); out['pi_se_cl'] = delta_se(pif, th, V)
    if fam == 'lognormal':
        out['mu'] = float(th[1]); out['mu_se'] = float(np.sqrt(Vn[1, 1])); out['mu_se_cl'] = float(np.sqrt(V[1, 1]))
        out['sigma'] = float(sh(th)); out['sigma_se'] = delta_se(sh, th, Vn); out['sigma_se_cl'] = delta_se(sh, th, V)
        med = lambda x: np.exp(x[1])
    else:
        out['scale_a'] = float(sc(th)); out['scale_a_se'] = delta_se(sc, th, Vn); out['scale_a_se_cl'] = delta_se(sc, th, V)
        out['shape_b'] = float(sh(th)); out['shape_b_se'] = delta_se(sh, th, Vn); out['shape_b_se_cl'] = delta_se(sh, th, V)
        if fam == 'loglogistic':
            med = lambda x: np.exp(x[1])
        else:
            med = lambda x: np.exp(x[1]) * np.log(2) ** (1 / np.exp(x[2]))
    out['median_uncured_days'] = float(med(th)); out['median_uncured_se'] = delta_se(med, th, Vn)
    out['median_uncured_se_cl'] = delta_se(med, th, V)
    out['_th'] = th.tolist()
    return out, m


def surv_model(o, grid=GRID):
    th = o['_th']
    La = th[1]; s = th[2]
    return cure_curve(o['family'], expit(th[0]), La, s, grid)


def gof(o, k, t, grid=GRID, minrisk=30):
    Sm = surv_model(o, grid)
    Sk = km_at(k, grid)
    ar = atrisk_at(t, grid)
    ok = ar >= minrisk
    dev = np.abs(Sm - Sk)
    return dict(max_abs_dev=float(dev[ok].max()), t_at_max=int(grid[ok][np.argmax(dev[ok])]),
                rmse=float(np.sqrt((dev[ok] ** 2).mean())), mean_abs=float(dev[ok].mean()),
                max_abs_dev_unrestricted=float(dev.max()), grid_max_with_risk=int(grid[ok].max()))


if __name__ == '__main__':
    res = {}
    groups = d['op'].values
    # ---- Part 1 KM ----
    for ms, (col, lcol) in dict(spud=('spud', 'l_spud'), completion=('comp', 'l_comp'), first_production=('fp', 'l_fp')).items():
        res.setdefault('km', {})[ms] = {}
        for dt in ['HH', 'SH', '?', 'ALL']:
            sub = d if dt == 'ALL' else d[d.drill == dt]
            t, e = tk(sub, col, lcol)
            k = km(t, e)
            row = dict(n=len(sub), events=int(e.sum()))
            for tt in [90, 180, 365, 540, 730]:
                S = float(km_at(k, np.array([tt]))[0]); lo = float(km_at(k, np.array([tt]), 'lo')[0]); hi = float(km_at(k, np.array([tt]), 'hi')[0])
                row[f'CI_{tt}'] = [1 - S, 1 - hi, 1 - lo]  # estimate, lower, upper cumulative incidence
            # KM median time (1-S>=0.5)
            idx = np.where(k['S'] <= 0.5)[0]
            row['km_median_days'] = float(k['t'][idx[0]]) if len(idx) else None
            res['km'][ms][dt] = row
            pickle.dump(k, open(OUT + f'_km_{ms}_{dt}.pkl', 'wb'))
    # ---- AJ competing risk ----
    nospud = d.spud.isna()
    defA = nospud & ((d.status == 'EX') | ((d.follow > 400) & (d.status != 'AC')))
    defB = nospud & ((d.status == 'EX') | (d.follow > 400))
    res['aj_definitions'] = dict(
        A='lapse = no spud date AND (status EX OR (follow>400 days AND status != AC)); lapse time set to 365 days (nominal expiry). AC wells with no spud date are treated as censored at follow, because AC with no dates likely means missing records, not a lapse.',
        B='lapse = no spud date AND (status EX OR follow>400 days), lapse time 365 days. Includes AC with missing dates as lapses (upper bound for lapse).',
        n_lapse_A=int(defA.sum()), n_lapse_B=int(defB.sum()))
    rng = np.random.default_rng(20261006)
    ops = d['op'].unique()
    opidx = {o: np.where(d['op'].values == o)[0] for o in ops}
    res['aj'] = {}
    for dname, lapse in [('A', defA), ('B', defB)]:
        res['aj'][dname] = {}
        for ms, (col, lcol) in dict(spud=('spud', 'l_spud'), first_production=('fp', 'l_fp')).items():
            for dt in ['HH', 'SH', '?', 'ALL']:
                m = np.ones(len(d), bool) if dt == 'ALL' else (d.drill == dt).values
                sub = d[m]
                lap = lapse.values[m]
                ev = sub[col].notna().values
                t = np.where(ev, sub[lcol].values, np.where(lap, 365.0, sub['follow'].values)).astype(float)
                cause = np.where(ev, 1, np.where(lap, 2, 0))
                c1, c2 = cif(t, cause)
                row = dict(CIF_event={str(x): float(c1[x]) for x in [180, 365, 730]},
                           CIF_lapse={str(x): float(c2[x]) for x in [180, 365, 730]})
                # bootstrap by operator
                gsub = sub['op'].values
                uo = np.unique(gsub)
                pos = {o: np.where(gsub == o)[0] for o in uo}
                bs1 = []; bs2 = []
                for b in range(200):
                    pick = rng.choice(uo, len(uo), replace=True)
                    ii = np.concatenate([pos[o] for o in pick])
                    a1, a2 = cif(t[ii], cause[ii], np.array([180, 365, 730]))
                    bs1.append(a1); bs2.append(a2)
                bs1 = np.array(bs1); bs2 = np.array(bs2)
                row['CIF_event_ci95_opboot'] = {str(x): np.percentile(bs1[:, i], [2.5, 97.5]).tolist() for i, x in enumerate([180, 365, 730])}
                row['CIF_lapse_ci95_opboot'] = {str(x): np.percentile(bs2[:, i], [2.5, 97.5]).tolist() for i, x in enumerate([180, 365, 730])}
                res['aj'][dname][f'{ms}|{dt}'] = row
                if dname == 'A':
                    pickle.dump((c1, c2), open(OUT + f'_aj_{ms}_{dt}.pkl', 'wb'))
    # ---- Part 2 cure fits ----
    res['cure'] = {}
    for dt in ['HH', 'SH', '?', 'ALL']:
        sub = d if dt == 'ALL' else d[d.drill == dt]
        t, e = tk(sub, 'fp', 'l_fp')
        k = km(t, e)
        res['cure'][dt] = {}
        for fam in FAM:
            o, m = fit_cure(fam, t, e, sub['op'].values)
            o['gof'] = gof(o, k, t)
            res['cure'][dt][fam] = o
        # best
        best = min(FAM, key=lambda f: res['cure'][dt][f]['aic'])
        res['cure'][dt]['best_by_aic'] = best
        print(dt, {f: (round(res['cure'][dt][f]['aic'], 1), round(res['cure'][dt][f]['pi'], 3), round(res['cure'][dt][f]['gof']['max_abs_dev'], 4)) for f in FAM}, best)
    json.dump(res, open(OUT + '_res12.json', 'w'), indent=1, default=float)
