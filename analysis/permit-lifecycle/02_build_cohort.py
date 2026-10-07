import pandas as pd, numpy as np
W='/tmp/claude-0/-home-claude-midconsight-afd1ae36/74a26e63-918d-5e82-a5ab-dc2fe498447b/scratchpad/work/'
TODAY=pd.Timestamp('2026-10-06')
def d(s): 
    x=pd.to_datetime(s,errors='coerce')
    return x.where((x>='2000-01-01')&(x<=TODAY))
i=pd.read_csv(W+'itd.csv',dtype=str,keep_default_na=False); c=pd.read_csv(W+'comp.csv',dtype=str,keep_default_na=False)
i['appr']=d(i.Approval_Date); i['api10']=i.API_Number.str[:10]
p=i[(i.Application_Type=='DR')&i.Well_Class.isin(['O&G','OG'])&(i.appr>='2019-01-01')].copy()
p['drill']=p.Drill_Type.replace({'MU':'HH','DH':'SH'}).where(p.Drill_Type.isin(['SH','HH','DH','MU']),'?')
print('permits rows',len(p),'api10',p.api10.nunique())
# one row per well: earliest approval; drill type = horizontal if any HH
g=p.groupby('api10').agg(appr=('appr','min'),drill=('drill',lambda s:'HH' if (s=='HH').any() else ('SH' if (s=='SH').any() else '?')),op=('Operator_Number','first'),opname=('Entity_Name','first'),status=('Well_Status','first')).reset_index()
for k in ['Spud','Drilling_Finished','Well_Completion','First_Prod','First_Sales']: c[k+'_d']=d(c[k])
c['api10']=c.API_Number
cg=c.groupby('api10').agg(spud=('Spud_d','min'),done=('Drilling_Finished_d','min'),comp=('Well_Completion_d','min'),fp=('First_Prod_d','min'),fs=('First_Sales_d','min'),cls=('Class_Type','first')).reset_index()
m=g.merge(cg,on='api10',how='left')
print('wells',len(m),'matched to completions',m.comp.notna().sum()+ (m.comp.isna()&m.spud.notna()).sum(), 'with spud',m.spud.notna().sum(),'comp',m.comp.notna().sum(),'fp',m.fp.notna().sum())
for k in ['spud','done','comp','fp','fs']:
    m['l_'+k]=(m[k]-m.appr).dt.days
    s=m['l_'+k].dropna()
    print(k,'n',len(s),'neg',(s<0).sum(),'>1500',(s>1500).sum(),'median',s[(s>=0)].median())
m.to_pickle(W+'cohort.pkl')
