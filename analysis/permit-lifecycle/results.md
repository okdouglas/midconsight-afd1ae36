# Permit-to-production survival study, Oklahoma new-drill permits approved 2019 or later

Data cutoff 2026-10-06. 6,590 wells: 4,386 HH, 1,378 SH, 826 unknown drill type. Time unit is days from permit approval. Fits use right-censoring at follow-up.

## Headline

- Best model: log-logistic mixture cure. It wins AIC over Weibull and log-normal by 600 to 800 points in HH and 140 to 190 in SH, and has the smallest gap to Kaplan-Meier (max gap 2.4 points HH, 2.7 points SH).
- Cure fraction (never produce): HH 0.168 (SE 0.006 naive, 0.020 operator-clustered). SH 0.426 (SE 0.013 naive, 0.026 clustered).
- Median days to first production among eventual producers: HH 182 (SE 2.2), SH 133 (SE 3.8). Log-logistic shape b = 2.43 (HH), 2.14 (SH).
- The current weight 0.5^(t/60) is far off. It decays to zero. The empirical survivor plateaus at 0.18 to 0.45. RMSE vs KM is 0.33 (HH) and 0.46 (SH) on t in [0,730].
- A 3-parameter closed form tracks KM within 1.7 points everywhere on [0,730].
- Cox proportional hazards is rejected (Schoenfeld p < 0.001). The HH hazard is below SH early, then 2.3 times higher after day 120. Treat Cox HRs as averages.

## Methods

Kaplan-Meier: S(t) = prod over event times t_i <= t of (1 - d_i/n_i). Greenwood: Var[S(t)] = S(t)^2 * sum d_i / (n_i (n_i - d_i)). Bands use the log-log transform: S^exp(+-1.96 * sqrt(sum d/(n(n-d))) / |log S|). Cumulative incidence is 1 - S. Ties at day 0 are kept. Censoring time is the follow field.

Competing risk (Aalen-Johansen): CIF_1(t) = sum over t_i <= t of Shat(t_i-) * d1_i / n_i, where Shat is the all-cause KM. Intervals are 200-rep bootstrap over operators.

Lapse definition A: no spud date AND (status EX, or follow > 400 days with status not AC). Lapse time is set to 365 days (nominal expiry). AC wells with no spud date are censored, since AC without dates most likely means missing records. Definition B counts every no-spud well with follow > 400 days or status EX as lapsed, and gives an upper bound. Counts: A = 853, B = 1089.

Mixture cure: S(t) = pi + (1 - pi) S0(t). Events contribute (1-pi) f0(t). Censored wells contribute pi + (1-pi) S0(c). Families for S0:
- log-logistic: S0 = 1/(1+(t/a)^b)
- Weibull: S0 = exp(-(t/a)^b)
- log-normal: S0 = 1 - Phi((ln t - mu)/sigma)

Day-0 events are moved to 0.5 day. Parameters use logit(pi), log a (or mu), log b (or log sigma). MLE by BFGS from three starts. Hessian by finite differences. Natural-scale SEs by delta method. "Clustered" SEs use the sandwich H^-1 B H^-1 with B summed over 434 operators.

GOF: max and RMS absolute gap between model S(t) and KM on t in [0,730] where at least 30 wells are at risk (this holds for the whole range). The max gap is the KS-like statistic.

Cox: Breslow ties, cluster-robust SEs by operator. PH test: Grambsch-Therneau score test with g(t)=rank(t) and g(t)=log t. Statistic T = d * U' V U / sum (g-gbar)^2 with U = sum (g_k - gbar) r_k, r_k Schoenfeld residuals, V model covariance. Per-term T_j = d (VU)_j^2 / (V_jj sum (g-gbar)^2). Year 2025 and 2026 are pooled because 2026 has 1 percent producers.

## 1. Kaplan-Meier cumulative incidence, % (95% CI)

| Milestone | Type | n | events | 180 d | 365 d | 730 d | KM median (d) |
|---|---|---|---|---|---|---|---|
| Spud | HH | 4386 | 3701 | 79.6% (78.4, 80.8) | 82.2% (81.1, 83.3) | 83.5% (82.4, 84.6) | 40.0 |
| Spud | SH | 1378 | 999 | 67.1% (64.6, 69.5) | 70.4% (68.0, 72.8) | 72.4% (70.0, 74.7) | 59.0 |
| Spud | ? | 826 | 93 | 12.1% (9.9, 14.6) | 12.1% (9.9, 14.6) | 12.1% (9.9, 14.6) | not reached |
| Completion | HH | 4386 | 3666 | 46.7% (45.3, 48.2) | 74.7% (73.4, 75.9) | 81.3% (80.1, 82.4) | 193.0 |
| Completion | SH | 1378 | 993 | 55.3% (52.7, 57.9) | 66.5% (64.0, 69.0) | 70.7% (68.2, 73.1) | 151.0 |
| Completion | ? | 826 | 42 | 6.7% (5.0, 9.0) | 6.7% (5.0, 9.0) | 6.7% (5.0, 9.0) | not reached |
| First production | HH | 4386 | 3609 | 40.9% (39.5, 42.4) | 71.5% (70.2, 72.9) | 79.5% (78.3, 80.7) | 214.0 |
| First production | SH | 1378 | 784 | 39.3% (36.8, 42.0) | 49.6% (47.0, 52.2) | 55.3% (52.7, 57.9) | 373.0 |
| First production | ? | 826 | 85 | 12.5% (10.0, 15.5) | 16.6% (13.5, 20.3) | 16.6% (13.5, 20.3) | not reached |

Unknown-type permits rarely progress (about 11 percent spud). Most are probably permits that never drilled, so the type is unknown because no report exists.

### Competing-risk view (definition A), % with operator-bootstrap 95% CI

| Outcome | Type | event by 365 d | event by 730 d | lapse by 365 d (alt. def. B) |
|---|---|---|---|---|
| spud | HH | 82.2 (78.4, 85.1) | 83.6 (79.9, 86.3) | 13.0 (10.2, 16.7); B 15.6 |
| spud | SH | 70.4 (64.7, 75.4) | 72.4 (67.0, 77.4) | 20.0 (16.7, 24.9); B 27.5 |
| first_production | HH | 71.5 (65.8, 75.7) | 79.6 (75.4, 83.3) | 13.0 (10.0, 17.4); B 15.5 |
| first_production | SH | 49.6 (45.7, 53.4) | 55.3 (50.2, 59.1) | 20.0 (16.4, 24.5); B 27.4 |

Lapse is a small competitor for HH (13 percent) and larger for SH (20 percent). Because lapse is defined on never-spudded wells, it barely changes the first-production curve versus 1-KM.

## 2. Mixture cure fits to first production

| Type | Family | pi (SE; clustered SE) | scale a or mu (SE; clust.) | shape b or sigma (SE; clust.) | median among producers, d | logLik | AIC | BIC | max gap vs KM | RMSE vs KM |
|---|---|---|---|---|---|---|---|---|---|---|
| HH | loglogistic * | 0.168 (0.0058; 0.0200) | a 181.9 (2.2; 16.3) | b 2.431 (0.036; 0.225) | 181.9 | -24640.5 | 49287.0 | 49306.1 | 0.0236 | 0.0098 |
| HH | weibull | 0.171 (0.0058; 0.0195) | a 258.7 (3.5; 22.1) | b 1.317 (0.015; 0.091) | 195.8 | -25038.0 | 50082.0 | 50101.1 | 0.0840 | 0.0436 |
| HH | lognormal | 0.167 (0.0058; 0.0199) | mu 5.194 (0.014; 0.094) | sigma 0.811 (0.010; 0.052) | 180.1 | -24945.8 | 49897.7 | 49916.8 | 0.0522 | 0.0292 |
| SH | loglogistic * | 0.426 (0.0135; 0.0260) | a 132.7 (3.8; 9.8) | b 2.141 (0.069; 0.136) | 132.7 | -5728.2 | 11462.4 | 11478.1 | 0.0268 | 0.0132 |
| SH | weibull | 0.429 (0.0134; 0.0254) | a 204.0 (6.8; 14.4) | b 1.154 (0.029; 0.046) | 148.5 | -5822.2 | 11650.3 | 11666.0 | 0.0699 | 0.0322 |
| SH | lognormal | 0.425 (0.0135; 0.0264) | mu 4.906 (0.034; 0.071) | sigma 0.929 (0.025; 0.076) | 135.1 | -5798.1 | 11602.3 | 11618.0 | 0.0438 | 0.0193 |
| ? | loglogistic | 0.815 (0.0221; 0.0452) | a 149.9 (11.9; 24.5) | b 3.101 (0.364; 0.773) | 149.9 | -697.0 | 1400.0 | 1414.2 | 0.0152 | 0.0057 |
| ? | weibull * | 0.834 (0.0177; 0.0391) | a 162.6 (8.7; 20.3) | b 2.632 (0.237; 0.418) | 141.4 | -694.2 | 1394.3 | 1408.5 | 0.0140 | 0.0039 |
| ? | lognormal | 0.752 (0.0578; 0.1113) | mu 5.336 (0.254; 0.516) | sigma 0.838 (0.126; 0.304) | 207.7 | -706.9 | 1419.8 | 1434.0 | 0.0278 | 0.0131 |

* best by AIC. Naive SEs treat wells as independent and are too small. Operator clustering inflates the pi SE about 3.5 times and the scale SE about 7 times. Weibull is slightly better than log-logistic for the unknown group only (small n, 85 events); it is not used.

Pooled (all wells) log-logistic: pi 0.248, a 179.3, b 2.307, AIC 62,978 (Weibull 63,865, log-normal 63,697).

## 3. Covariate models

### Cox PH, time to first production (n = 6590, events = 4478), cluster-robust 95% CI

| Term | HR | 95% CI (clustered) | clustered SE of log HR | model SE | PH test p (rank) |
|---|---|---|---|---|---|
| Horizontal vs straight/directional | 1.60 | 1.34 to 1.92 | 0.091 | 0.046 | 0.0000 |
| Unknown drill type vs straight/directional | 0.36 | 0.22 to 0.59 | 0.251 | 0.132 | 0.0302 |
| Top-25 operator vs other | 1.24 | 1.03 to 1.49 | 0.094 | 0.037 | 0.0000 |
| Approved 2020 vs 2019 | 0.99 | 0.80 to 1.23 | 0.110 | 0.061 | 0.0000 |
| Approved 2021 vs 2019 | 1.60 | 1.29 to 1.99 | 0.111 | 0.052 | 0.0000 |
| Approved 2022 vs 2019 | 1.38 | 1.09 to 1.74 | 0.118 | 0.045 | 0.0000 |
| Approved 2023 vs 2019 | 1.19 | 0.86 to 1.65 | 0.166 | 0.051 | 0.0056 |
| Approved 2024 vs 2019 | 1.34 | 1.05 to 1.70 | 0.122 | 0.053 | 0.0002 |
| Approved 2025-2026 vs 2019 | 1.02 | 0.71 to 1.45 | 0.180 | 0.070 | 0.0851 |

Global Schoenfeld test: chi2 = 575 on 9 df (rank), 353 (log t). p < 1e-70. PH fails. Censoring at 730 days gives the same picture (global p < 1e-100).

The failure has an obvious cause. A cure fraction makes hazards cross: HH wells are slower to start but far more likely to finish. Piecewise Cox by window (left-truncated entry, censored at window end), clustered SE of log HR in brackets:

| Term | 0-120 d | 120-365 d | after 365 d |
|---|---|---|---|
| Horizontal vs straight/directional | 0.90 [0.17] | 2.26 [0.13] | 1.75 [0.23] |
| Top-25 operator vs other | 0.72 [0.30] | 1.39 [0.11] | 2.98 [0.26] |
| Approved 2021 vs 2019 | 0.88 [0.25] | 2.47 [0.12] | 1.24 [0.39] |
| Approved 2022 vs 2019 | 0.83 [0.31] | 1.93 [0.12] | 1.38 [0.30] |
| Approved 2024 vs 2019 | 0.99 [0.27] | 1.83 [0.13] | 0.75 [0.46] |

Events per window: 1342, 2564, 572. Unknown-type has too few late events to estimate (separation).

Cox stratified by drill type (separate baseline per type; operator-bootstrap CIs):

| Term | HR | 95% CI |
|---|---|---|
| Top-25 operator vs other | 1.23 | 1.01 to 1.51 |
| Approved 2020 vs 2019 | 0.99 | 0.80 to 1.24 |
| Approved 2021 vs 2019 | 1.65 | 1.31 to 2.08 |
| Approved 2022 vs 2019 | 1.42 | 1.11 to 1.81 |
| Approved 2023 vs 2019 | 1.20 | 0.85 to 1.69 |
| Approved 2024 vs 2019 | 1.38 | 1.08 to 1.78 |
| Approved 2025-2026 vs 2019 | 1.04 | 0.73 to 1.47 |

### Log-logistic mixture cure with covariates (the AFT view, PH not needed)

logit(pi) and log(a) both linear in covariates, shared shape b = 2.44 (clustered SE 0.20). AIC 61836. Time ratio above 1 means slower among producers. Odds ratio of never producing below 1 means more likely to produce. Reference: SH, other operator, approved 2019.

| Term | OR of never producing (95% CI, clustered) | Time ratio among producers (95% CI, clustered) |
|---|---|---|
| Horizontal | 0.37 (0.29, 0.48) | 1.22 (1.05, 1.43) |
| Unknown type | 4.05 (2.09, 7.85) | 1.23 (0.93, 1.63) |
| Top-25 operator | 0.44 (0.31, 0.63) | 1.28 (1.04, 1.58) |
| Approved 2020 | 0.85 (0.56, 1.27) | 1.21 (1.00, 1.45) |
| Approved 2021 | 0.40 (0.25, 0.65) | 0.93 (0.74, 1.18) |
| Approved 2022 | 0.53 (0.34, 0.81) | 0.98 (0.77, 1.25) |
| Approved 2023 | 0.79 (0.48, 1.30) | 0.97 (0.65, 1.45) |
| Approved 2024 | 0.65 (0.39, 1.07) | 0.93 (0.73, 1.19) |
| Approved 2025-26 | 1.23 (0.66, 2.30) | 0.94 (0.76, 1.17) |

Reading: HH and top-25 operators finish more often (cure odds roughly 0.4) but take about 20 to 30 percent longer among producers. The Cox HR above 1 for both comes from the cure channel, not from speed. Year effects on cure for 2025-26 are weakly identified because of censoring.

## 4. Lead weight S(t) = share still pre-production

Closed form: w(t) = c + (1 - c) / (1 + (t/a)^b), t in days. This is the log-logistic cure survivor with c = pi. Least-squares fit to daily KM over t = 0..730.

| Type | c | a (days) | b | max abs error vs KM | at day | RMSE | MLE-params max error |
|---|---|---|---|---|---|---|---|
| HH | 0.183 | 177.9 | 2.687 | 0.0164 | 64 | 0.0052 | 0.0236 |
| SH | 0.452 | 123.7 | 2.400 | 0.0152 | 150 | 0.0071 | 0.0268 |
| All wells | 0.264 | 174.0 | 2.510 | 0.0079 | 64 | 0.0028 | 0.0182 |
| Unknown | 0.833 | 137.8 | 4.226 | 0.0095 | 257 | 0.0031 | 0.0180 |

A simpler 2-parameter floor plus exponential, w = c + (1-c) 0.5^(t/h), fails the shape: max error 0.13 (HH), 0.095 (SH). The S-shape (flat for about 30 days, then a drop) needs b > 2.

| Type | floor+exp c | half-life h | max error |
|---|---|---|---|
| HH | 0.083 | 197 | 0.130 |
| SH | 0.433 | 122 | 0.095 |
| ALL | 0.189 | 190 | 0.111 |

Suggested lookup values (KM survivor):

| Type | 30 d | 60 d | 120 d | 180 d | 365 d | 540 d | 730 d |
|---|---|---|---|---|---|---|---|
| HH | 0.991 | 0.944 | 0.788 | 0.591 | 0.285 | 0.223 | 0.205 |
| SH | 0.988 | 0.929 | 0.730 | 0.607 | 0.504 | 0.466 | 0.447 |
| ALL | 0.991 | 0.946 | 0.791 | 0.620 | 0.365 | 0.305 | 0.285 |

## 5. Current weight 0.5^(t/60) versus KM

| Type | RMSE [0,730] | RMSE [0,365] | max gap (day) | Area KM (d) | Area current (d) | Area diff (current minus KM) | Current as share of KM area |
|---|---|---|---|---|---|---|---|
| HH | 0.327 | 0.403 | 0.543 (103) | 310 | 87 | -223 | 0.28 |
| SH | 0.460 | 0.454 | 0.491 (347) | 418 | 87 | -332 | 0.21 |
| ALL | 0.376 | 0.433 | 0.544 (108) | 352 | 87 | -265 | 0.25 |

The current weight gives 0.5 at day 60. KM reaches 0.5 at about day 214 (HH, 1-S), 373 (SH), 237 (all). At day 180 the current weight is 0.125, KM says 0.59 (HH) and 0.61 (SH). The current weight discounts leads about 4 to 5 times too fast and has no floor. The empirical floor is 0.18 (HH) to 0.45 (SH): wells that never produce keep their lead status forever. If the score means "chance this lead is still unproduced", use the fit. If it means "urgency", keep a decay but add a floor and slow the half-life to about 120 to 200 days.

## 6. Sensitivity (log-logistic cure, clustered SEs where shown)

| Scenario | Type | n | producers | raw median days (observed producers) | days to half of CI(730) | 365-d CI | cure pi | median among producers (a) |
|---|---|---|---|---|---|---|---|---|
| Base | HH | 4386 | 3609 | 181 | 176 | 71.5% | 0.168 (0.020) | 181.9 (16.3) |
| Base | SH | 1378 | 784 | 124 | 123 | 49.6% | 0.426 (0.026) | 132.7 (9.8) |
| Base | ALL | 6590 | 4478 | 169 | 170 | 63.5% | 0.248 (0.022) | 179.3 (14.0) |
| Approved 2021-2024 | HH | 2427 | 2136 | 176 | 175 | 79.5% | 0.113 (0.017) | 176.2 (18.3) |
| Approved 2021-2024 | SH | 884 | 500 | 131 | 130 | 50.2% | 0.431 (0.030) | 133.9 (13.0) |
| Approved 2021-2024 | ALL | 3311 | 2636 | 168 | 167 | 71.7% | 0.198 (0.023) | 167.7 (15.1) |
| Drop status EX | HH | 4024 | 3609 | 181 | 176 | 78.0% | 0.087 (0.011) | 183.1 (16.4) |
| Drop status EX | SH | 1281 | 784 | 124 | 123 | 53.3% | 0.382 (0.025) | 132.8 (9.8) |
| Drop status EX | ALL | 6130 | 4478 | 169 | 171 | 68.8% | 0.177 (0.019) | 181.8 (14.2) |
| Drop EX, ND, NE | HH | 3832 | 3579 | 181 | 176 | 81.4% | 0.051 (0.007) | 182.2 (16.4) |
| Drop EX, ND, NE | SH | 1157 | 777 | 124 | 122 | 58.9% | 0.322 (0.023) | 131.3 (9.7) |
| Drop EX, ND, NE | ALL | 5559 | 4431 | 168 | 170 | 73.5% | 0.127 (0.017) | 179.6 (14.0) |
| Drop AC with no spud date | HH | 4270 | 3604 | 181 | 176 | 73.4% | 0.149 (0.021) | 181.0 (16.1) |
| Drop AC with no spud date | SH | 1274 | 783 | 124 | 123 | 53.5% | 0.381 (0.025) | 132.4 (9.7) |
| Drop AC with no spud date | ALL | 6187 | 4472 | 169 | 169 | 67.5% | 0.210 (0.021) | 176.3 (13.5) |
| Spud, no prod, 365+ d since spud = failed | HH | 4386 | 3609 | 181 | 176 | 71.5% | 0.169 (0.020) | 181.6 (16.3) |
| Spud, no prod, 365+ d since spud = failed | SH | 1378 | 784 | 124 | 123 | 49.6% | 0.428 (0.026) | 132.1 (9.5) |
| Spud, no prod, 365+ d since spud = failed | ALL | 6590 | 4478 | 169 | 170 | 63.5% | 0.250 (0.022) | 178.6 (14.0) |

spud_nofp_failed_after_365d: wells with a spud date, no first production, and >=365 days since spud are treated as known never-producers (KM: never censored, stay in risk set; cure model: contribute log pi). Base case censors them at follow. Count of such known failures: 314. Wells with status AC but no spud date: 403.

Findings:
- Median days among producers is stable. HH 176 to 183, SH 131 to 134. Timing is robust.
- Cure fraction is not stable. HH falls from 0.168 to 0.087 (drop EX) and 0.051 (drop EX, ND, NE). It is mostly a measure of how many dead permits are in the file.
- Restricting to 2021-2024 lowers HH cure to 0.113 and lifts 365-day incidence to 79.5%, because 2019-2020 permits and the young 2025+ permits are removed.
- Treating spud-no-production as failed changes almost nothing (cure +0.001 to +0.002). Those 314 wells are already counted as never-producing by the model, since their censoring times are long.

## Threats to validity

- Missing completion reports. A well with no report looks like it never progressed. 403 AC (active) wells have no spud date at all, so some "cured" wells produce. This is missing-not-at-random, and it biases the cure fraction up and the 365-day incidence down.
- Unknown drill type (826 wells) is itself a symptom of no report. It is not a random subgroup, so type-specific results condition on having a report.
- Left truncation at 2019. The cohort is permits approved from 2019-01-01, so there is no left truncation of permits themselves. But wells permitted earlier and producing later are excluded, and 2019 approvals carry COVID-era delays.
- Right censoring and cure identification. 2025 and 2026 permits have under 21 months of follow-up. A plateau needs long follow-up. Cure estimates lean on 2019-2024 data. Cure and long-delay wells are not separable in recent cohorts.
- Informative censoring. Permits that expire are removed from the active file. If expiry is recorded as status EX with no date, we cannot time the lapse. We set it to 365 days.
- Operator clustering. 434 operators, and large operators drive HH. Naive SEs are 3 to 7 times too small. Clustered SEs are used throughout. With a few big clusters, the sandwich SE can still be too small. Cox stratified results use a cluster bootstrap.
- Proportional hazards fails. Cox HRs are time-averaged and shift sign over the first 120 days. Use the cure/AFT table for interpretation.
- Parametric form. The log-logistic is within 2.7 points of KM but not exact. The least-squares closed form is within 1.7 points. Fits are descriptive, not structural.
- Dates are the earliest recorded dates, possibly reporting dates. Negative lags were set to 0 upstream.
- Production data cutoff. Latest recorded first production is June 2026. Wells that began in July to October 2026 may not yet appear, which understates the newest cohort.

## Files

- fig1_km_by_milestone.png, fig2_cure_fit_vs_km.png, fig3_weight_comparison.png, fig4_cox_forest.png, results.json, results.md. Code: lib.py, part12.py, part3456.py, part7.py, figs.py, mkmd.py.