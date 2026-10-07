import json
D='/tmp/claude-0/-home-claude-midconsight-afd1ae36/74a26e63-918d-5e82-a5ab-dc2fe498447b/scratchpad/stats/'
r=json.load(open(D+'_res_all.json'))
r['meta']=dict(cutoff='2026-10-06',n_wells=6590,notes='All times in days since permit approval. Cure fraction pi = share who never produce.')
json.dump(r,open(D+'results.json','w'),indent=1)
L=[]
P=L.append
def f(x,n=3): return f'{x:.{n}f}'
def ci(v): return f'{v[0]*100:.1f}% ({v[1]*100:.1f}, {v[2]*100:.1f})'
P('# Permit-to-production survival study, Oklahoma new-drill permits approved 2019 or later\n')
P('Data cutoff 2026-10-06. 6,590 wells: 4,386 HH, 1,378 SH, 826 unknown drill type. Time unit is days from permit approval. Fits use right-censoring at follow-up.\n')
P('## Headline\n')
h=r['cure']['HH']['loglogistic']; s=r['cure']['SH']['loglogistic']
P(f"- Best model: log-logistic mixture cure. It wins AIC over Weibull and log-normal by 600 to 800 points in HH and 140 to 190 in SH, and has the smallest gap to Kaplan-Meier (max gap {h['gof']['max_abs_dev']*100:.1f} points HH, {s['gof']['max_abs_dev']*100:.1f} points SH).")
P(f"- Cure fraction (never produce): HH {h['pi']:.3f} (SE {h['pi_se']:.3f} naive, {h['pi_se_cl']:.3f} operator-clustered). SH {s['pi']:.3f} (SE {s['pi_se']:.3f} naive, {s['pi_se_cl']:.3f} clustered).")
P(f"- Median days to first production among eventual producers: HH {h['median_uncured_days']:.0f} (SE {h['median_uncured_se']:.1f}), SH {s['median_uncured_days']:.0f} (SE {s['median_uncured_se']:.1f}). Log-logistic shape b = {h['shape_b']:.2f} (HH), {s['shape_b']:.2f} (SH).")
P("- The current weight 0.5^(t/60) is far off. It decays to zero. The empirical survivor plateaus at 0.18 to 0.45. RMSE vs KM is 0.33 (HH) and 0.46 (SH) on t in [0,730].")
P("- A 3-parameter closed form tracks KM within 1.7 points everywhere on [0,730].")
P("- Cox proportional hazards is rejected (Schoenfeld p < 0.001). The HH hazard is below SH early, then 2.3 times higher after day 120. Treat Cox HRs as averages.\n")
P('## Methods\n')
P('Kaplan-Meier: S(t) = prod over event times t_i <= t of (1 - d_i/n_i). Greenwood: Var[S(t)] = S(t)^2 * sum d_i / (n_i (n_i - d_i)). Bands use the log-log transform: S^exp(+-1.96 * sqrt(sum d/(n(n-d))) / |log S|). Cumulative incidence is 1 - S. Ties at day 0 are kept. Censoring time is the follow field.\n')
P('Competing risk (Aalen-Johansen): CIF_1(t) = sum over t_i <= t of Shat(t_i-) * d1_i / n_i, where Shat is the all-cause KM. Intervals are 200-rep bootstrap over operators.\n')
P('Lapse definition A: no spud date AND (status EX, or follow > 400 days with status not AC). Lapse time is set to 365 days (nominal expiry). AC wells with no spud date are censored, since AC without dates most likely means missing records. Definition B counts every no-spud well with follow > 400 days or status EX as lapsed, and gives an upper bound. '
  f"Counts: A = {r['aj_definitions']['n_lapse_A'] if 'n_lapse_A' in r['aj_definitions'] else ''}, B = {r['aj_definitions'].get('n_lapse_B','')}.\n")
P('Mixture cure: S(t) = pi + (1 - pi) S0(t). Events contribute (1-pi) f0(t). Censored wells contribute pi + (1-pi) S0(c). Families for S0:')
P('- log-logistic: S0 = 1/(1+(t/a)^b)')
P('- Weibull: S0 = exp(-(t/a)^b)')
P('- log-normal: S0 = 1 - Phi((ln t - mu)/sigma)\n')
P('Day-0 events are moved to 0.5 day. Parameters use logit(pi), log a (or mu), log b (or log sigma). MLE by BFGS from three starts. Hessian by finite differences. Natural-scale SEs by delta method. "Clustered" SEs use the sandwich H^-1 B H^-1 with B summed over 434 operators.\n')
P('GOF: max and RMS absolute gap between model S(t) and KM on t in [0,730] where at least 30 wells are at risk (this holds for the whole range). The max gap is the KS-like statistic.\n')
P('Cox: Breslow ties, cluster-robust SEs by operator. PH test: Grambsch-Therneau score test with g(t)=rank(t) and g(t)=log t. Statistic T = d * U\' V U / sum (g-gbar)^2 with U = sum (g_k - gbar) r_k, r_k Schoenfeld residuals, V model covariance. Per-term T_j = d (VU)_j^2 / (V_jj sum (g-gbar)^2). Year 2025 and 2026 are pooled because 2026 has 1 percent producers.\n')
P('## 1. Kaplan-Meier cumulative incidence, % (95% CI)\n')
P('| Milestone | Type | n | events | 180 d | 365 d | 730 d | KM median (d) |'); P('|---|---|---|---|---|---|---|---|')
for m,mn in [('spud','Spud'),('completion','Completion'),('first_production','First production')]:
    for dt in ['HH','SH','?']:
        x=r['km'][m][dt]
        P(f"| {mn} | {dt} | {x['n']} | {x['events']} | {ci(x['CI_180'])} | {ci(x['CI_365'])} | {ci(x['CI_730'])} | {x['km_median_days'] if x['km_median_days'] else 'not reached'} |")
P('\nUnknown-type permits rarely progress (about 11 percent spud). Most are probably permits that never drilled, so the type is unknown because no report exists.\n')
P('### Competing-risk view (definition A), % with operator-bootstrap 95% CI\n')
P('| Outcome | Type | event by 365 d | event by 730 d | lapse by 365 d (alt. def. B) |'); P('|---|---|---|---|---|')
for m in ['spud','first_production']:
    for dt in ['HH','SH']:
        a=r['aj']['A'][f'{m}|{dt}']; b=r['aj']['B'][f'{m}|{dt}']
        e1=a['CIF_event_ci95_opboot']['365']; e2=a['CIF_event_ci95_opboot']['730']; l=a['CIF_lapse_ci95_opboot']['365']
        P(f"| {m} | {dt} | {a['CIF_event']['365']*100:.1f} ({e1[0]*100:.1f}, {e1[1]*100:.1f}) | {a['CIF_event']['730']*100:.1f} ({e2[0]*100:.1f}, {e2[1]*100:.1f}) | {a['CIF_lapse']['365']*100:.1f} ({l[0]*100:.1f}, {l[1]*100:.1f}); B {b['CIF_lapse']['365']*100:.1f} |")
P('\nLapse is a small competitor for HH (13 percent) and larger for SH (20 percent). Because lapse is defined on never-spudded wells, it barely changes the first-production curve versus 1-KM.\n')
P('## 2. Mixture cure fits to first production\n')
P('| Type | Family | pi (SE; clustered SE) | scale a or mu (SE; clust.) | shape b or sigma (SE; clust.) | median among producers, d | logLik | AIC | BIC | max gap vs KM | RMSE vs KM |'); P('|---|---|---|---|---|---|---|---|---|---|---|')
for dt in ['HH','SH','?']:
    for fam in ['loglogistic','weibull','lognormal']:
        o=r['cure'][dt][fam]
        if fam=='lognormal':
            p1=f"mu {o['mu']:.3f} ({o['mu_se']:.3f}; {o['mu_se_cl']:.3f})"; p2=f"sigma {o['sigma']:.3f} ({o['sigma_se']:.3f}; {o['sigma_se_cl']:.3f})"
        else:
            p1=f"a {o['scale_a']:.1f} ({o['scale_a_se']:.1f}; {o['scale_a_se_cl']:.1f})"; p2=f"b {o['shape_b']:.3f} ({o['shape_b_se']:.3f}; {o['shape_b_se_cl']:.3f})"
        star=' *' if r['cure'][dt]['best_by_aic']==fam else ''
        P(f"| {dt} | {fam}{star} | {o['pi']:.3f} ({o['pi_se']:.4f}; {o['pi_se_cl']:.4f}) | {p1} | {p2} | {o['median_uncured_days']:.1f} | {o['ll']:.1f} | {o['aic']:.1f} | {o['bic']:.1f} | {o['gof']['max_abs_dev']:.4f} | {o['gof']['rmse']:.4f} |")
P('\n* best by AIC. Naive SEs treat wells as independent and are too small. Operator clustering inflates the pi SE about 3.5 times and the scale SE about 7 times. Weibull is slightly better than log-logistic for the unknown group only (small n, 85 events); it is not used.\n')
P('Pooled (all wells) log-logistic: pi 0.248, a 179.3, b 2.307, AIC 62,978 (Weibull 63,865, log-normal 63,697).\n')
P('## 3. Covariate models\n')
c=r['cox']['full']; 
P(f"### Cox PH, time to first production (n = {c['n']}, events = {c['events']}), cluster-robust 95% CI\n")
P('| Term | HR | 95% CI (clustered) | clustered SE of log HR | model SE | PH test p (rank) |'); P('|---|---|---|---|---|---|')
for t,v in c['terms'].items():
    P(f"| {v['label']} | {v['HR']:.2f} | {v['HR_ci_cluster'][0]:.2f} to {v['HR_ci_cluster'][1]:.2f} | {v['se_cluster']:.3f} | {v['se_model']:.3f} | {c['schoenfeld']['rank']['per_term'][t]['p']:.4f} |")
P(f"\nGlobal Schoenfeld test: chi2 = {c['schoenfeld']['rank']['global_chi2']:.0f} on 9 df (rank), {c['schoenfeld']['log_t']['global_chi2']:.0f} (log t). p < 1e-70. PH fails. Censoring at 730 days gives the same picture (global p < 1e-100).\n")
P('The failure has an obvious cause. A cure fraction makes hazards cross: HH wells are slower to start but far more likely to finish. Piecewise Cox by window (left-truncated entry, censored at window end), clustered SE of log HR in brackets:\n')
P('| Term | 0-120 d | 120-365 d | after 365 d |'); P('|---|---|---|---|')
W=r['cox']['windows']
for t in ['hh','top25','y2021','y2022','y2024']:
    row=[]
    for w in ['0-120','120-365','365-inf']:
        x=W[w]['terms'][t]; row.append(f"{x['HR']:.2f} [{x['se_cluster']:.2f}]")
    P(f"| {c['terms'][t]['label']} | "+' | '.join(row)+' |')
P(f"\nEvents per window: {W['0-120']['events']}, {W['120-365']['events']}, {W['365-inf']['events']}. Unknown-type has too few late events to estimate (separation).\n")
cs=r['cox']['strat_drill']
P('Cox stratified by drill type (separate baseline per type; operator-bootstrap CIs):\n')
P('| Term | HR | 95% CI |'); P('|---|---|---|')
for t,v in cs['terms'].items():
    P(f"| {v['label']} | {v['HR']:.2f} | {v['HR_ci_cluster'][0]:.2f} to {v['HR_ci_cluster'][1]:.2f} |")
cc=r['cure_cov']
P(f"\n### Log-logistic mixture cure with covariates (the AFT view, PH not needed)\n")
P(f"logit(pi) and log(a) both linear in covariates, shared shape b = {cc['shape_b']:.2f} (clustered SE {cc['shape_b_se_cl']:.2f}). AIC {cc['aic']:.0f}. Time ratio above 1 means slower among producers. Odds ratio of never producing below 1 means more likely to produce. Reference: SH, other operator, approved 2019.\n")
P('| Term | OR of never producing (95% CI, clustered) | Time ratio among producers (95% CI, clustered) |'); P('|---|---|---|')
lab={'hh':'Horizontal','unk':'Unknown type','top25':'Top-25 operator','y2020':'Approved 2020','y2021':'Approved 2021','y2022':'Approved 2022','y2023':'Approved 2023','y2024':'Approved 2024','y2025p':'Approved 2025-26'}
for k in lab:
    a=cc['cure_logit'][k]; b=cc['time_ratio'][k]
    P(f"| {lab[k]} | {a['odds_ratio_never']:.2f} ({a['or_ci_cluster'][0]:.2f}, {a['or_ci_cluster'][1]:.2f}) | {b['time_ratio']:.2f} ({b['tr_ci_cluster'][0]:.2f}, {b['tr_ci_cluster'][1]:.2f}) |")
P('\nReading: HH and top-25 operators finish more often (cure odds roughly 0.4) but take about 20 to 30 percent longer among producers. The Cox HR above 1 for both comes from the cure channel, not from speed. Year effects on cure for 2025-26 are weakly identified because of censoring.\n')
P('## 4. Lead weight S(t) = share still pre-production\n')
P('Closed form: w(t) = c + (1 - c) / (1 + (t/a)^b), t in days. This is the log-logistic cure survivor with c = pi. Least-squares fit to daily KM over t = 0..730.\n')
P('| Type | c | a (days) | b | max abs error vs KM | at day | RMSE | MLE-params max error |'); P('|---|---|---|---|---|---|---|---|')
for dt,n in [('HH','HH'),('SH','SH'),('ALL','All wells'),('?','Unknown')]:
    w=r['weights'][dt]; q=w['closed_form_ls']
    P(f"| {n} | {q['c']:.3f} | {q['a']:.1f} | {q['b']:.3f} | {q['max_abs_err']:.4f} | {q['t_at_max']} | {q['rmse']:.4f} | {w['closed_form_mle']['max_abs_err']:.4f} |")
P('\nA simpler 2-parameter floor plus exponential, w = c + (1-c) 0.5^(t/h), fails the shape: max error 0.13 (HH), 0.095 (SH). The S-shape (flat for about 30 days, then a drop) needs b > 2.\n')
P('| Type | floor+exp c | half-life h | max error |'); P('|---|---|---|---|')
for dt in ['HH','SH','ALL']:
    q=r['weights'][dt]['exp_floor_ls']; P(f"| {dt} | {q['c']:.3f} | {q['halflife']:.0f} | {q['max_abs_err']:.3f} |")
P('\nSuggested lookup values (KM survivor):\n')
P('| Type | 30 d | 60 d | 120 d | 180 d | 365 d | 540 d | 730 d |'); P('|---|---|---|---|---|---|---|---|')
for dt in ['HH','SH','ALL']:
    k=r['weights'][dt]['km_at']; P(f"| {dt} | "+' | '.join(f"{k[x]:.3f}" for x in ['30','60','120','180','365','540','730'])+' |')
P('\n## 5. Current weight 0.5^(t/60) versus KM\n')
P('| Type | RMSE [0,730] | RMSE [0,365] | max gap (day) | Area KM (d) | Area current (d) | Area diff (current minus KM) | Current as share of KM area |'); P('|---|---|---|---|---|---|---|---|')
for dt in ['HH','SH','ALL']:
    w=r['weights'][dt]; q=w['current_w']
    P(f"| {dt} | {q['rmse']:.3f} | {q['rmse_0_365']:.3f} | {q['max_abs_err']:.3f} ({q['t_at_max']}) | {w['km_auc_days_0_730']:.0f} | {q['auc_w_days']:.0f} | {q['auc_diff_days']:.0f} | {q['auc_ratio_w_over_km']:.2f} |")
P('\nThe current weight gives 0.5 at day 60. KM reaches 0.5 at about day 214 (HH, 1-S), 373 (SH), 237 (all). At day 180 the current weight is 0.125, KM says 0.59 (HH) and 0.61 (SH). The current weight discounts leads about 4 to 5 times too fast and has no floor. The empirical floor is 0.18 (HH) to 0.45 (SH): wells that never produce keep their lead status forever. If the score means "chance this lead is still unproduced", use the fit. If it means "urgency", keep a decay but add a floor and slow the half-life to about 120 to 200 days.\n')
P('## 6. Sensitivity (log-logistic cure, clustered SEs where shown)\n')
P('| Scenario | Type | n | producers | raw median days (observed producers) | days to half of CI(730) | 365-d CI | cure pi | median among producers (a) |'); P('|---|---|---|---|---|---|---|---|---|')
names={'base':'Base','approved_2021_2024':'Approved 2021-2024','drop_EX':'Drop status EX','drop_ND_EX_NE':'Drop EX, ND, NE','drop_AC_without_spud_date':'Drop AC with no spud date','spud_nofp_failed_after_365d':'Spud, no prod, 365+ d since spud = failed'}
for sn,v in r['sensitivity'].items():
    for dt in ['HH','SH','ALL']:
        x=v[dt]; m=x['cure_loglogistic']
        P(f"| {names[sn]} | {dt} | {x['n']} | {x['n_producers']} | {x['raw_median_days_among_observed_producers']:.0f} | {x['km_half_of_CI730_days']} | {x['CI_365']*100:.1f}% | {m['pi']:.3f} ({m['pi_se_cl']:.3f}) | {m['median_susceptible']:.1f} ({m['median_susceptible_se_cl']:.1f}) |")
P(f"\n{r['sens_notes']} Count of such known failures: {r['n_known_fail_spud_nofp_ge365d']}. Wells with status AC but no spud date: {r['n_AC_no_spud']}.\n")
P('Findings:')
P('- Median days among producers is stable. HH 176 to 183, SH 131 to 134. Timing is robust.')
P('- Cure fraction is not stable. HH falls from 0.168 to 0.087 (drop EX) and 0.051 (drop EX, ND, NE). It is mostly a measure of how many dead permits are in the file.')
P('- Restricting to 2021-2024 lowers HH cure to 0.113 and lifts 365-day incidence to 79.5%, because 2019-2020 permits and the young 2025+ permits are removed.')
P('- Treating spud-no-production as failed changes almost nothing (cure +0.001 to +0.002). Those 314 wells are already counted as never-producing by the model, since their censoring times are long.\n')
P('## Threats to validity\n')
for t in [
 'Missing completion reports. A well with no report looks like it never progressed. 403 AC (active) wells have no spud date at all, so some "cured" wells produce. This is missing-not-at-random, and it biases the cure fraction up and the 365-day incidence down.',
 'Unknown drill type (826 wells) is itself a symptom of no report. It is not a random subgroup, so type-specific results condition on having a report.',
 'Left truncation at 2019. The cohort is permits approved from 2019-01-01, so there is no left truncation of permits themselves. But wells permitted earlier and producing later are excluded, and 2019 approvals carry COVID-era delays.',
 'Right censoring and cure identification. 2025 and 2026 permits have under 21 months of follow-up. A plateau needs long follow-up. Cure estimates lean on 2019-2024 data. Cure and long-delay wells are not separable in recent cohorts.',
 'Informative censoring. Permits that expire are removed from the active file. If expiry is recorded as status EX with no date, we cannot time the lapse. We set it to 365 days.',
 'Operator clustering. 434 operators, and large operators drive HH. Naive SEs are 3 to 7 times too small. Clustered SEs are used throughout. With a few big clusters, the sandwich SE can still be too small. Cox stratified results use a cluster bootstrap.',
 'Proportional hazards fails. Cox HRs are time-averaged and shift sign over the first 120 days. Use the cure/AFT table for interpretation.',
 'Parametric form. The log-logistic is within 2.7 points of KM but not exact. The least-squares closed form is within 1.7 points. Fits are descriptive, not structural.',
 'Dates are the earliest recorded dates, possibly reporting dates. Negative lags were set to 0 upstream.',
 'Production data cutoff. Latest recorded first production is June 2026. Wells that began in July to October 2026 may not yet appear, which understates the newest cohort.']:
    P('- '+t)
P('\n## Files\n')
P('- fig1_km_by_milestone.png, fig2_cure_fit_vs_km.png, fig3_weight_comparison.png, fig4_cox_forest.png, results.json, results.md. Code: lib.py, part12.py, part3456.py, part7.py, figs.py, mkmd.py.')
t='\n'.join(L)
assert '—' not in t and '–' not in t
open(D+'results.md','w').write(t)
