import numpy as np, pandas as pd
from scipy import optimize, stats
from scipy.special import expit, logsumexp

GRID = np.arange(0, 731)
Z95 = 1.959963984540054


def sp(x):
    return np.logaddexp(0.0, x)


# ---------------- Kaplan-Meier with Greenwood, log-log CI ----------------
def km(t, e):
    t = np.asarray(t, float); e = np.asarray(e, int)
    ut = np.unique(t[e == 1])
    n = np.array([(t >= u).sum() for u in ut], float)
    d = np.array([((t == u) & (e == 1)).sum() for u in ut], float)
    S = np.cumprod(1 - d / n)
    gw = np.cumsum(d / (n * (n - d) + 1e-300))
    gw = np.where(n - d > 0, gw, np.nan)
    with np.errstate(all='ignore'):
        # log-log (Kalbfleisch-Prentice) interval; Greenwood var of log S
        se_ll = np.sqrt(gw) / np.abs(np.log(S))
        lo = S ** np.exp(Z95 * se_ll)
        hi = S ** np.exp(-Z95 * se_ll)
    se_S = S * np.sqrt(gw)
    return dict(t=ut, n=n, d=d, S=S, lo=lo, hi=hi, se=se_S)


def km_at(k, grid=GRID, key='S'):
    """Step-function evaluation, S=1 before first event."""
    idx = np.searchsorted(k['t'], grid, side='right') - 1
    base = {'S': 1.0, 'lo': 1.0, 'hi': 1.0, 'se': 0.0}[key]
    v = np.where(idx >= 0, k[key][np.clip(idx, 0, None)], base)
    return v


def atrisk_at(t, grid=GRID):
    t = np.sort(np.asarray(t, float))
    return len(t) - np.searchsorted(t, grid, side='left')


# ---------------- Aalen-Johansen cumulative incidence ----------------
def cif(t, cause, grid=GRID):
    """cause: 0 censored, 1 event of interest, 2 competing. returns CIF1, CIF2 on grid."""
    t = np.asarray(t, float); cause = np.asarray(cause, int)
    ut = np.unique(t[cause > 0])
    n = np.array([(t >= u).sum() for u in ut], float)
    d1 = np.array([((t == u) & (cause == 1)).sum() for u in ut], float)
    d2 = np.array([((t == u) & (cause == 2)).sum() for u in ut], float)
    S = np.cumprod(1 - (d1 + d2) / n)
    Sprev = np.concatenate([[1.0], S[:-1]])
    c1 = np.cumsum(Sprev * d1 / n)
    c2 = np.cumsum(Sprev * d2 / n)
    idx = np.searchsorted(ut, grid, side='right') - 1
    f = lambda c: np.where(idx >= 0, c[np.clip(idx, 0, None)], 0.0)
    return f(c1), f(c2)


# ---------------- Mixture cure models ----------------
def _base(fam, lt, La, s):
    """returns logS0, logf0 given log t, location La (log a or mu), s = log shape"""
    if fam == 'loglogistic':
        b = np.exp(s)
        u = b * (lt - La)
        return -sp(u), s + u - lt - 2 * sp(u)
    if fam == 'weibull':
        b = np.exp(s)
        u = np.exp(b * (lt - La))
        return -u, s - lt + b * (lt - La) - u
    if fam == 'lognormal':
        sig = np.exp(s)
        z = (lt - La) / sig
        return stats.norm.logsf(z), stats.norm.logpdf(z) - s - lt
    raise ValueError(fam)


def S0_curve(fam, La, s, t):
    t = np.maximum(np.asarray(t, float), 1e-9)
    lS, _ = _base(fam, np.log(t), La, s)
    return np.exp(lS)


def cure_curve(fam, pi, La, s, t):
    return pi + (1 - pi) * S0_curve(fam, La, s, t)


class CureModel:
    """Mixture cure: S(t)=pi+(1-pi)S0(t). logit pi = Xp g ; location = Xl d ; shared log-shape s.
    t=0 is replaced by 0.5 day. kind: 1 event, 0 censored (at follow), -1 known never-event
    (contributes log pi)."""

    def __init__(self, fam, t, kind, Xp, Xl, groups=None):
        self.fam = fam
        self.t = np.maximum(np.asarray(t, float), 0.5)
        self.lt = np.log(self.t)
        self.kind = np.asarray(kind, int)
        self.Xp = np.asarray(Xp, float); self.Xl = np.asarray(Xl, float)
        self.kp = self.Xp.shape[1]; self.kl = self.Xl.shape[1]
        self.groups = groups

    def unpack(self, th):
        g = th[:self.kp]; d = th[self.kp:self.kp + self.kl]; s = th[-1]
        return g, d, s

    def ll_obs(self, th):
        g, d, s = self.unpack(th)
        eta = self.Xp @ g
        La = self.Xl @ d
        lS0, lf0 = _base(self.fam, self.lt, La, s)
        lpi = -sp(-eta); l1p = -sp(eta)
        ll_ev = l1p + lf0
        ll_ce = np.logaddexp(lpi, l1p + lS0)
        return np.where(self.kind == 1, ll_ev, np.where(self.kind == 0, ll_ce, lpi))

    def nll(self, th):
        v = -self.ll_obs(th).sum()
        return v if np.isfinite(v) else 1e12

    def start(self):
        th = np.zeros(self.kp + self.kl + 1)
        th[0] = -1.5
        med = np.median(self.t[self.kind == 1]) if (self.kind == 1).any() else 150
        th[self.kp] = np.log(med)
        th[-1] = np.log(2.0) if self.fam != 'lognormal' else np.log(0.7)
        return th

    def fit(self, th0=None):
        best = None
        starts = [self.start() if th0 is None else th0]
        s2 = self.start().copy(); s2[0] = 0.0; starts.append(s2)
        s3 = self.start().copy(); s3[0] = -3.0; s3[-1] += 0.4; starts.append(s3)
        for st in starts:
            r = optimize.minimize(self.nll, st, method='BFGS', options=dict(maxiter=2000, gtol=1e-6))
            r = optimize.minimize(self.nll, r.x, method='Nelder-Mead',
                                  options=dict(maxiter=4000, xatol=1e-7, fatol=1e-9)) if len(st) <= 4 else r
            r = optimize.minimize(self.nll, r.x, method='BFGS', options=dict(maxiter=2000, gtol=1e-7))
            if best is None or r.fun < best.fun:
                best = r
        self.th = best.x; self.ll = -best.fun
        self.k = len(self.th)
        self.H = num_hess(self.nll, self.th)
        self.Vn = np.linalg.pinv(self.H)
        self.n = len(self.t)
        self.aic = 2 * self.k - 2 * self.ll
        self.bic = self.k * np.log(self.n) - 2 * self.ll
        if self.groups is not None:
            self.Vr = self.robust()
        else:
            self.Vr = self.Vn
        return self

    def scores(self):
        th = self.th; p = len(th); S = np.zeros((self.n, p))
        for j in range(p):
            h = 1e-5 * max(1.0, abs(th[j]))
            a = th.copy(); b = th.copy(); a[j] += h; b[j] -= h
            S[:, j] = (self.ll_obs(a) - self.ll_obs(b)) / (2 * h)
        return S

    def robust(self):
        S = self.scores()
        df = pd.DataFrame(S); df['g'] = self.groups
        G = df.groupby('g').sum().values
        B = G.T @ G
        m = G.shape[0]
        adj = m / (m - 1.0)
        return adj * self.Vn @ B @ self.Vn


def num_hess(f, x, rel=1e-4):
    p = len(x); H = np.zeros((p, p))
    h = rel * np.maximum(1.0, np.abs(x))
    f0 = f(x)
    for i in range(p):
        for j in range(i, p):
            ei = np.zeros(p); ej = np.zeros(p); ei[i] = h[i]; ej[j] = h[j]
            if i == j:
                H[i, i] = (f(x + ei) - 2 * f0 + f(x - ei)) / h[i] ** 2
            else:
                H[i, j] = H[j, i] = (f(x + ei + ej) - f(x + ei - ej) - f(x - ei + ej) + f(x - ei - ej)) / (4 * h[i] * h[j])
    return H


def delta_se(fn, th, V, eps=1e-6):
    """SE of scalar fn(th) by delta method."""
    g = np.zeros(len(th))
    for j in range(len(th)):
        a = th.copy(); b = th.copy(); h = eps * max(1, abs(th[j]))
        a[j] += h; b[j] -= h
        g[j] = (fn(a) - fn(b)) / (2 * h)
    return float(np.sqrt(max(g @ V @ g, 0)))
