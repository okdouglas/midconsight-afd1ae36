import pandas as pd, numpy as np
W='/tmp/claude-0/-home-claude-midconsight-afd1ae36/74a26e63-918d-5e82-a5ab-dc2fe498447b/scratchpad/work/'
TODAY=pd.Timestamp('2026-10-06')
m=pd.read_pickle(W+'cohort.pkl')
m['follow']=(TODAY-m.appr).dt.days
for k in ['spud','comp','fp']: m.loc[m['l_'+k]<0,'l_'+k]=0   # re-approved after spud: treat as already underway
H=[30,60,90,120,180,270,365,540,730]
def table(df,label):
    print(f'\n--- {label}  (n={len(df)})')
    print('milestone  '+'  '.join(f'd{h:>3}' for h in H))
    for k,nm in (('spud','spudded'),('comp','completed'),('fp','1st prod')):
        row=[]
        for h in H:
            e=df[df.follow>=h]   # only permits old enough to have been observed h days
            row.append(f'{(e["l_"+k]<=h).mean()*100:4.0f}%' if len(e)>=30 else '  n/a')
        print(f'{nm:10} '+' '.join(row))
table(m,'ALL oil&gas new-drill permits, approved 2019+')
for d_ in ['HH','SH']: table(m[m.drill==d_],f'drill type {d_}')
# restrict to mature cohorts (>=2 years follow) for ultimate fate
mat=m[m.follow>=730]
print('\nMature cohort (approved >=2y ago) n=',len(mat))
for d_ in ['ALL','HH','SH']:
    x=mat if d_=='ALL' else mat[mat.drill==d_]
    print(d_,'n',len(x),'ever spudded %.0f%%'%(x.l_spud.notna().mean()*100),'ever 1st prod %.0f%%'%(x.l_fp.notna().mean()*100),'never (expired/abandoned) %.0f%%'%(x.l_spud.isna().mean()*100))
# percentiles among those that completed
for d_ in ['HH','SH']:
    x=m[(m.drill==d_)]
    print(d_,'permit->spud pctiles 25/50/75/90:',x.l_spud.quantile([.25,.5,.75,.9]).round().tolist(),'| ->1st prod:',x.l_fp.quantile([.25,.5,.75,.9]).round().tolist())
# by approval year
m['yr']=m.appr.dt.year
print('\nby approval year: share spudded within 180d / first prod within 365d / median days to 1st prod')
for y,x in m.groupby('yr'):
    a=x[x.follow>=180]; b=x[x.follow>=365]
    print(y,len(x),'%.0f%%'%((a.l_spud<=180).mean()*100) if len(a)>30 else 'n/a','%.0f%%'%((b.l_fp<=365).mean()*100) if len(b)>30 else 'n/a',x.l_fp.median())
# permit status of never-drilled
print(m[m.l_spud.isna()].status.value_counts().head(6).to_dict())
# operator size effect: top-25 operators by permit count vs the rest
top=m.groupby('op').size().sort_values(ascending=False)
big=set(top.head(25).index); m['size']=np.where(m.op.isin(big),'top25 operators','all other')
for s,x in m.groupby('size'):
    a=x[x.follow>=365]
    print(s,len(x),'spud<=90d %.0f%%'%((x[x.follow>=90].l_spud<=90).mean()*100),'fp<=365d %.0f%%'%((a.l_fp<=365).mean()*100),'median days to fp',x.l_fp.median())
m.to_pickle(W+'cohort2.pkl')
