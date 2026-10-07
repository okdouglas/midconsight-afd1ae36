import sys, json, warnings
sys.path.insert(0, '/tmp/claude-0/-home-claude-midconsight-afd1ae36/74a26e63-918d-5e82-a5ab-dc2fe498447b/scratchpad/stats')
warnings.filterwarnings('ignore')
import part3456 as P
from part3456 import *
cov = [c for c in COV if c not in ('hh', 'unk')]
# sanity: Schoenfeld residual sums
R = np.asarray(r_m.schoenfeld_residuals); print('schoenfeld col sums', np.nansum(R, axis=0).round(4))
rng = np.random.default_rng(7)
ops = d['op'].values; uo = np.unique(ops); pos = {o: np.where(ops == o)[0] for o in uo}
B = []
for b in range(200):
    pick = rng.choice(uo, len(uo), replace=True)
    ii = np.concatenate([pos[o] for o in pick])
    s = d.iloc[ii]
    m = PHReg(s['tfp'].values, s[cov].values, status=s['efp'].values, strata=s['drill'].values, ties='breslow').fit(disp=False)
    B.append(m.params)
B = np.array(B); se = B.std(axis=0, ddof=1)
res = json.load(open(OUT + '_res_all.json'))
for i, c in enumerate(cov):
    t = res['cox']['strat_drill']['terms'][c]
    t['se_cluster'] = float(se[i])
    t['HR_ci_cluster'] = [float(np.exp(t['coef'] - Z95 * se[i])), float(np.exp(t['coef'] + Z95 * se[i]))]
    t['p_cluster'] = float(2 * stats.norm.sf(abs(t['coef'] / se[i])))
    t['se_note'] = 'operator-cluster bootstrap, 200 reps'
json.dump(res, open(OUT + '_res_all.json', 'w'), indent=1, default=float)
print(se.round(3))
