"""Génère les extractions FICTIVES de la démo Qualité de livraison (rejets, decanting, réceptions 101 et 20)."""
import random, datetime as dt, os, collections
from openpyxl import Workbook
random.seed(31)
ENTS=[f'ENTREPÔT {i}' for i in range(1,8)]
PREF={'ENTREPÔT 1':'41','ENTREPÔT 2':'42','ENTREPÔT 3':'43','ENTREPÔT 4':'44','ENTREPÔT 5':'45','ENTREPÔT 6':'46','ENTREPÔT 7':'489'}
W=[.12,.18,.10,.16,.08,.14,.22]            # part du volume
DEC={'ENTREPÔT 1':.020,'ENTREPÔT 2':.042,'ENTREPÔT 3':.012,'ENTREPÔT 4':.036,'ENTREPÔT 5':.008,'ENTREPÔT 6':.050,'ENTREPÔT 7':.024}
REJ={'ENTREPÔT 1':.004,'ENTREPÔT 2':.013,'ENTREPÔT 3':.003,'ENTREPÔT 4':.010,'ENTREPÔT 5':.002,'ENTREPÔT 6':.016,'ENTREPÔT 7':.006}
SSCC_SHARE=.3
START,END=dt.date(2026,9,1),dt.date(2026,11,24)
WEEKVOL={w:random.uniform(.8,1.15) for w in range(36,49)}
ITEMS=[str(random.randint(1000000,9999999)) for _ in range(400)]
HOT=ITEMS[:12]   # articles souvent bombés
def nouvel_item(item, ent):
    """Catalogue propre à chaque entrepôt (même règle que repartirItemsParEntrepotDemo en Apps Script)"""
    h = 0
    for ch in str(item): h = (h * 31 + ord(ch)) % 100000
    return ent.split()[-1] + ('00000' + str(100 + (h % 60) * 37))[-6:]
def rnd(n): return ''.join(random.choice('0123456789') for _ in range(n))
def barcode(e):
    if random.random()<SSCC_SHARE: return '00099'+rnd(15)
    p=PREF[e]; return p+rnd(20-len(p))
ymd=lambda d:int(d.strftime('%Y%m%d'))
hms=lambda s:int(f'{s//3600:02d}{s%3600//60:02d}{s%60:02d}')
r20,r101,dec,rej=[],[],[],[]
d=START
while d<=END:
    w=d.isocalendar()[1]
    daily=int(3000/6*WEEKVOL[w]*(0 if d.weekday()==6 else 1))
    for e,wt in zip(ENTS,W):
        for _ in range(int(daily*wt*random.uniform(.85,1.15))):
            bc=barcode(e); s=random.randint(4*3600,21*3600); item=nouvel_item(random.choice(ITEMS), e)
            ad=d if s<18*3600 else d+dt.timedelta(days=1)
            parcel=bc[-10:][:9]
            fam=f'FAMILLE {random.randint(1,8)}'; sect=random.choice(['TYPE 1','TYPE 1','TYPE 2','TYPE 3','TYPE 4'])
            r20.append([ 'SITE DÉMO',parcel,ymd(d),hms(s),f'OP{random.randint(10,60)}','RECEP',sect,fam,item,f'QUAI {random.randint(1,24):02d}',
                ymd(ad),hms((s+random.randint(600,7200))%86400),'AUTO',random.choice(['ZONE A','ZONE B','ZONE C']),'ENTREPOT',
                str(100+ENTS.index(e)),'01',e,ymd(d-dt.timedelta(days=random.randint(1,3))),hms(random.randint(0,86399)),random.randint(1,24)])
            if bc.startswith('00099'):
                ms=d+dt.timedelta(hours=random.randint(2,30))
                r101.append(['SITE DÉMO','101',bc[3:],'STD',str(random.randint(1000000,9999999)),ymd(d),hms(s),ymd(ms),hms(random.randint(0,86399)),
                    round(random.uniform(1,30),1),random.choice(['CDE','REAPPRO']),str(random.randint(1,40)),random.randint(1,24),item,sect,fam,random.choice([1,2,4,6,12]),random.choice(['A','B','C']),e])
            if random.random()<DEC[e]*random.uniform(.7,1.3):
                it=nouvel_item(random.choice(HOT), e) if random.random()<.35 else item
                dd=d+dt.timedelta(days=random.randint(0,1))
                dec.append(['SITE DÉMO',ymd(dd),bc,str(random.randint(10**8,10**9-1)),'STOCK AUTO','DONE',it,ymd(dd+dt.timedelta(days=random.randint(200,900))),random.choice(['FR','ES','IT','PT','PL','CN','VN']),random.randint(1,24),'DECANTING'])
            if random.random()<REJ[e]*random.uniform(.7,1.3):
                cause=random.choices(['WMS BARCODE MISSING','NO STORAGE REQUEST','WCS BARCODE MISSING','PARCEL NOT FOUND','DIMENSION ERROR'],[.45,.3,.1,.1,.05])[0]
                rs=s+random.randint(600,10800)
                rej.append([d,rs,bc,f'CT{rnd(8)}',random.choice(['QUAI','CONVOYEUR','STOCK AUTO']),f'EMP-{random.randint(1,40):02d}',cause,f'Colis {bc} rejeté : {cause.lower()}'])
    d+=dt.timedelta(days=1)
# rejets sans code-barre (non identifiés)
dd=START
while dd<=END:
    for _ in range(random.randint(0,3)):
        rej.append([dd,random.randint(5*3600,22*3600),'',f'CT{rnd(8)}','CONVOYEUR',f'EMP-{random.randint(1,40):02d}',random.choice(['PARCEL NOT FOUND','DIMENSION ERROR']),'Étiquette illisible'])
    dd+=dt.timedelta(days=1)
print('r20',len(r20),'r101',len(r101),'dec',len(dec),'rej',len(rej))
def save(path, header, rows):
    wb=Workbook(); ws=wb.active; ws.append(header)
    for r in rows: ws.append(r)
    for col in ws.iter_cols(min_row=2):
        for c in col:
            if isinstance(c.value,str): c.number_format='@'
    wb.save(path)
os.makedirs('out',exist_ok=True)
H20=['Warehouse','PARCEL','DOCK_RECEIPT_DATE','DOCK_RECEIPT_TIME','OPERATOR_REC','PROFIL_REC','SECT','FAMILLE','ITEM','UNLOADING','ADRESSING_DATE','ADRESSING_TIME','ADRESSING_PROFIL','ZONE','EXP_THIRD_TYPE','EXP_NUM_THIRD','EXP_SNUM_THIRD','EXP_NAME','SHIPPING_DATE','SHIPPING_TIME','QTY']
H101=['Warehouse','PROCESS_TYPE','COLIS','SUB_PROCESS_TYPE','ORDER','DATE_DECHARGEMENT','HEURE_DECHARGEMENT','DATE_MISE_EN_STOCK','HEURE_MISE_EN_STOCK','LEADTIME_H','TYPE_CDE','POSTE_CDE','QTE_ITEM','ITEM','SECTEUR','FAMILLE','PCB_CARTON','CLASSE_LOG','NOM_FRN']
HDEC=['Warehouse','DATE_DECANTING','SOURCE','REQUESTID','DESTINATION','STATUT','ITEM','EXPIDATE','MADEIN','QTY','PROCESS']
HREJ=['Date','Heure','Code-barres','Container ID','Origine','Emplacement','Cause','Détails']
wk=lambda v:dt.datetime.strptime(str(v),'%Y%m%d').date().isocalendar()[1]
for name,H,rows,key in [('recep_20',H20,r20,lambda r:wk(r[2])),('recep_101',H101,r101,lambda r:wk(r[5])),('decanting',HDEC,dec,lambda r:wk(r[1]))]:
    g=collections.defaultdict(list)
    for r in rows: g[key(r)].append(r)
    for w,rs in sorted(g.items()): save(f'out/{name}_S{w}.xlsx',H,rs)
# rejets : un fichier tous les 4 jours
rej.sort(key=lambda r:(r[0],r[1]))
seen=set(); rows=[]
for r in rej:
    s=r[1]%86400; k=(r[0],s)
    while k in seen: s+=1; k=(r[0],s)
    seen.add(k); rows.append([r[0].strftime('%d/%m/%Y'),f'{s//3600:02d}:{s%3600//60:02d}:{s%60:02d}']+r[2:])
g=collections.defaultdict(list)
for r in rows:
    dd=dt.datetime.strptime(r[0],'%d/%m/%Y').date(); g[(dd-START).days//4].append(r)
for i,rs in sorted(g.items()):
    save(f'out/rejet_{(START+dt.timedelta(days=4*i)).strftime("%Y%m%d")}.xlsx',HREJ,rs)
# contrôle des taux par entrepôt
cnt=collections.Counter(r[17] for r in r20); cd=collections.Counter()
inv={v:k for k,v in PREF.items()}
for r in dec:
    bc=r[2]; e=inv.get(bc[:3]) or inv.get(bc[:2])
    cd[e]+=1
print({e:round(100*(DEC[e]+REJ[e]),1) for e in ENTS})
