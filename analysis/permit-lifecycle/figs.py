import sys, json, pickle
sys.path.insert(0, '/tmp/claude-0/-home-claude-midconsight-afd1ae36/74a26e63-918d-5e82-a5ab-dc2fe498447b/scratchpad/stats')
import numpy as np
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from lib import *
OUT = '/tmp/claude-0/-home-claude-midconsight-afd1ae36/74a26e63-918d-5e82-a5ab-dc2fe498447b/scratchpad/stats/'
plt.rcParams.update({'font.family': 'sans-serif', 'font.sans-serif': ['DejaVu Sans', 'Arial'], 'font.size': 10,
                     'axes.spines.top': False, 'axes.spines.right': False, 'axes.grid': True, 'grid.alpha': 0.25})
res = json.load(open(OUT + '_res_all.json'))
C = {'HH': '#1f5fa8', 'SH': '#d6781e', '?': '#6b6b6b', 'ALL': '#333333'}
NM = {'HH': 'Horizontal (HH)', 'SH': 'Straight/directional (SH)', '?': 'Unknown', 'ALL': 'All wells'}
ld = lambda ms, dt: pickle.load(open(OUT + f'_km_{ms}_{dt}.pkl', 'rb'))
# Fig 1
fig, ax = plt.subplots(1, 3, figsize=(13, 4.2), sharey=True)
for a, (ms, ttl) in zip(ax, [('spud', 'Permit to spud'), ('completion', 'Permit to completion'), ('first_production', 'Permit to first production')]):
    for dt in ['HH', 'SH']:
        k = ld(ms, dt)
        S = km_at(k); lo = km_at(k, key='lo'); hi = km_at(k, key='hi')
        a.step(GRID, 1 - S, where='post', color=C[dt], lw=2, label=NM[dt])
        a.fill_between(GRID, 1 - hi, 1 - lo, step='post', color=C[dt], alpha=0.2, lw=0)
    a.set_title(ttl, fontsize=11); a.set_xlabel('Days since permit approval'); a.set_xlim(0, 730); a.set_ylim(0, 1)
    a.set_xticks([0, 180, 365, 540, 730])
ax[0].set_ylabel('Cumulative incidence (share of permits reaching milestone)')
ax[0].legend(loc='lower right', frameon=False)
fig.suptitle('Kaplan-Meier cumulative incidence with 95% Greenwood (log-log) bands. Permits approved 2019 or later.', fontsize=10.5, y=1.0)
fig.tight_layout(); fig.savefig(OUT + 'fig1_km_by_milestone.png', dpi=200, bbox_inches='tight'); plt.close(fig)
# Fig 2
fig, ax = plt.subplots(1, 2, figsize=(11, 4.4), sharey=True)
fams = {'loglogistic': ('Log-logistic cure', '-'), 'weibull': ('Weibull cure', '--'), 'lognormal': ('Log-normal cure', ':')}
for a, dt in zip(ax, ['HH', 'SH']):
    k = ld('first_production', dt)
    S = km_at(k); lo = km_at(k, key='lo'); hi = km_at(k, key='hi')
    a.step(GRID, 1 - S, where='post', color='black', lw=1.6, label='Kaplan-Meier')
    a.fill_between(GRID, 1 - hi, 1 - lo, step='post', color='black', alpha=0.15, lw=0)
    best = res['cure'][dt]['best_by_aic']
    for f, (lab, ls) in fams.items():
        o = res['cure'][dt][f]; th = o['_th']
        y = 1 - cure_curve(f, expit(th[0]), th[1], th[2], np.maximum(GRID, 0.5))
        a.plot(GRID, y, ls=ls, lw=2.4 if f == best else 1.4, color=C[dt] if f == best else '#888888',
               label=f"{lab}{' (best, AIC)' if f == best else ''}")
    o = res['cure'][dt][best]
    a.axhline(1 - o['pi'], color=C[dt], lw=0.8, ls='-.')
    a.text(735, 1 - o['pi'], f" plateau {1-o['pi']:.2f}\n (cure {o['pi']:.2f})", va='center', fontsize=8.5, color=C[dt])
    a.set_title(NM[dt] + f"  (n={o['n']:,})", fontsize=11); a.set_xlabel('Days since permit approval'); a.set_xlim(0, 730)
    a.set_xticks([0, 180, 365, 540, 730]); a.set_ylim(0, 1)
    a.legend(loc='lower right', frameon=False, fontsize=8.5)
ax[0].set_ylabel('Cumulative share with first production')
fig.tight_layout(); fig.savefig(OUT + 'fig2_cure_fit_vs_km.png', dpi=200, bbox_inches='tight'); plt.close(fig)
# Fig 3
cur = pickle.load(open(OUT + '_curves.pkl', 'rb'))
fig, ax = plt.subplots(1, 3, figsize=(13, 4.2), sharey=True)
W0 = 0.5 ** (GRID / 60)
for a, dt in zip(ax, ['HH', 'SH', 'ALL']):
    w = res['weights'][dt]
    a.plot(GRID, W0, color='#b22222', lw=2, label='Current: 0.5^(t/60)')
    a.plot(GRID, cur[dt]['Sk'], color='black', lw=1.8, label='Empirical survivor (KM)')
    c = w['closed_form_ls']
    a.plot(GRID, cur[dt]['Scf'], color=C[dt] if dt != 'ALL' else '#2a7f62', lw=2, ls='--',
           label=f"Fit: c+(1-c)/(1+(t/a)^b)\nc={c['c']:.2f}, a={c['a']:.0f}, b={c['b']:.2f}")
    a.set_title(NM[dt], fontsize=11); a.set_xlabel('Days since permit approval'); a.set_xlim(0, 730); a.set_ylim(0, 1.02)
    a.set_xticks([0, 180, 365, 540, 730]); a.legend(frameon=False, fontsize=8.5, loc='upper right')
    a.text(0.42, 0.11, f"RMSE of current vs KM: {w['current_w']['rmse']:.2f}\nRMSE of fit vs KM: {c['rmse']:.3f}", transform=a.transAxes, fontsize=8.5)
ax[0].set_ylabel('Weight / share still pre-production, S(t)')
fig.tight_layout(); fig.savefig(OUT + 'fig3_weight_comparison.png', dpi=200, bbox_inches='tight'); plt.close(fig)
# Fig 4
cx = res['cox']
terms = ['hh', 'unk', 'top25', 'y2020', 'y2021', 'y2022', 'y2023', 'y2024', 'y2025p']
fig, a = plt.subplots(figsize=(8.6, 5))
ypos = np.arange(len(terms))[::-1]
for off, key, col, lab in [(0.13, 'full', '#1f5fa8', 'Cox, all follow-up'), (-0.13, 'trunc730', '#d6781e', 'Cox, censored at 730 days')]:
    hr = [cx[key]['terms'][t]['HR'] for t in terms]
    lo = [cx[key]['terms'][t]['HR_ci_cluster'][0] for t in terms]; hi = [cx[key]['terms'][t]['HR_ci_cluster'][1] for t in terms]
    a.errorbar(hr, ypos + off, xerr=[np.array(hr) - lo, np.array(hi) - hr], fmt='o', color=col, capsize=3, label=lab, ms=5)
a.axvline(1, color='black', lw=0.8)
a.set_xscale('log'); a.minorticks_off(); a.set_xticks([0.25, 0.5, 1, 2, 3]); a.set_xticklabels(['0.25', '0.5', '1', '2', '3'])
a.set_yticks(ypos); a.set_yticklabels([cx['full']['terms'][t]['label'] for t in terms])
a.set_xlabel('Hazard ratio of first production (log scale); above 1 means faster. 95% CI, operator-clustered')
a.legend(frameon=False, loc='upper center', bbox_to_anchor=(0.45, -0.16), ncol=2)
a.set_title('Cox proportional hazards, time from permit to first production (6,590 wells, 4,478 events)\nPH is rejected (Schoenfeld p<0.001): read as average effects only', fontsize=10)
fig.tight_layout(); fig.savefig(OUT + 'fig4_cox_forest.png', dpi=200, bbox_inches='tight'); plt.close(fig)
print('ok')
