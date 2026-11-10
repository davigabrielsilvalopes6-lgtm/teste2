"""Technical crop/padding only: retain native RGBA pixels; never synthesize art."""
from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage
import json, hashlib
ROOT=Path(__file__).resolve().parents[1]
folder=ROOT/'assets/characters/player'
source=folder/'source/personagem_animacao_caminhada.png'
im=Image.open(source).convert('RGBA')
xs=[0,254,474,692,910,1126,1330]
ys=[0,279,575,871,1182]
atlas=Image.new('RGBA',(192*6,272*4))
frames=[]
for row,direction in enumerate(['down','up','left','right']):
 for col in range(6):
  cell=im.crop((xs[col],ys[row],xs[col+1],ys[row+1]))
  a=np.asarray(cell)
  labels,n=ndimage.label(a[:,:,3]>16,structure=np.ones((3,3)))
  counts=np.bincount(labels.ravel());counts[0]=0
  label=int(counts.argmax())
  yy,xx=np.where(labels==label)
  l,t,r,b=int(xx.min()),int(yy.min()),int(xx.max())+1,int(yy.max())+1
  crop=(max(0,l-4),max(0,t-4),min(cell.width,r+4),min(cell.height,b+4))
  art=cell.crop(crop)
  px=96-round((l+r)/2-crop[0]);py=264-(b-crop[1])
  assert px>=0 and py>=0 and px+art.width<=192 and py+art.height<=272
  # Direct copy, no compositing, recoloring, interpolation or alpha thresholding.
  atlas.paste(art,(col*192+px,row*272+py))
  frames.append({'direction':direction,'frame':col,'sourceRect':[xs[col]+crop[0],ys[row]+crop[1],art.width,art.height],'atlasRect':[col*192+px,row*272+py,art.width,art.height],'mainBounds':[l,t,r,b]})
atlas.save(folder/'player-walk-atlas.png',optimize=True)
metadata={'source':source.name,'sourceSize':list(im.size),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'frameWidth':192,'frameHeight':272,'anchor':[96,264],'scale':0.125,'directions':['down','up','left','right'],'columns':6,'rows':4,'walkFps':8,'idleFrames':[0],'combatAnimation':'provided pose with existing equipment effects; no attack frames supplied','layers':['outfit_original_flattened'],'missingLayers':['body','hair','shirt','pants','boots','gloves','helmet','armor','accessory'],'frames':frames}
(folder/'player_animations.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
print('Atlas',atlas.size,'frame',192,272,'main bounds',[(f['direction'],f['frame'],f['mainBounds']) for f in frames])
