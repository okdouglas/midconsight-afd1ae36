import sys, csv, openpyxl, time
src, out, cols = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
t=time.time()
wb=openpyxl.load_workbook(src, read_only=True, data_only=True)
ws=wb.worksheets[0]
it=ws.iter_rows(values_only=True)
hdr=[str(h).strip() if h is not None else '' for h in next(it)]
idx=[hdr.index(c) for c in cols if c in hdr]
missing=[c for c in cols if c not in hdr]
print('sheet',ws.title,'missing',missing,flush=True)
n=0
with open(out,'w',newline='') as f:
    w=csv.writer(f); w.writerow([hdr[i] for i in idx])
    for r in it:
        w.writerow([ (v.strftime('%Y-%m-%d') if hasattr(v,'strftime') else ('' if v is None else v)) for v in (r[i] if i<len(r) else None for i in idx)])
        n+=1
        if n%200000==0: print(n, round(time.time()-t), flush=True)
print('done',n,round(time.time()-t),flush=True)
