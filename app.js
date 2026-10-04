const $=id=>document.getElementById(id);
const ids=['price','down','months','rate'];
const rub=n=>Math.round(n).toLocaleString('ru-RU')+' ₽';
let planImage=null,uploading=false,submitted=false,valid=null,uploadVersion=0;
let prepared=null,prepareTimer=null,toastTimer=null;
function readValues(){
 if(ids.some(id=>!$(id).value.trim()))return {error:'Заполните все четыре поля.'};
 const v=Object.fromEntries(ids.map(id=>[id,Number($(id).value.replace(/\s/g,'').replace(',','.'))]));
 if(Object.values(v).some(n=>!Number.isFinite(n)))return {error:'Введите числовые значения.'};
 if(v.price<=0||v.price>1e12)return {error:'Укажите стоимость больше нуля и не более 1 трлн ₽.'};
 if(v.down<0||v.down>=v.price)return {error:'Первоначальный взнос должен быть от 0 ₽ и меньше стоимости квартиры.'};
 if(!Number.isInteger(v.months)||v.months<1||v.months>600)return {error:'Укажите срок от 1 до 600 месяцев.'};
 if(v.rate<0||v.rate>100)return {error:'Укажите ставку от 0 до 100 %.'};
 v.loan=v.price-v.down;const r=v.rate/1200;v.payment=r===0?v.loan/v.months:v.loan*r/(-Math.expm1(-v.months*Math.log1p(r)));return v;
}
function update(showError=false){const v=readValues();valid=v.error?null:v;$('error').textContent=showError&&v.error?v.error:'';
 $('download').disabled=uploading;
 for(const key of ['price','down','loan'])$('out-'+key).textContent=valid?rub(v[key]):'—';
 $('out-rate').textContent=valid?v.rate.toLocaleString('ru-RU')+' %':'—';$('out-term').textContent=valid?v.months+' мес.':'—';
 $('out-payment').replaceChildren(document.createTextNode(valid?rub(v.payment):'— ₽'));const small=document.createElement('small');small.textContent='в месяц';$('out-payment').append(small);
 $('status').textContent=uploading?'Подготавливаем планировку…':valid?'Карточку можно сохранить и отправить клиенту.':'Заполните параметры, чтобы сохранить карточку.';schedulePrepare();return valid;
}
function groupMoneyInput(value){
 const compact=value.replace(/\s/g,'');
 // Keep invalid input visible for validation; never silently change its numeric meaning.
 if(!/^-?\d*(?:[.,]\d*)?$/.test(compact))return value;
 const [whole,...fraction]=compact.split(/([.,])/);
 return whole.replace(/\B(?=(\d{3})+(?!\d))/g,' ')+fraction.join('');
}
function formatMoneyInput(input){
 const raw=input.value,start=input.selectionStart??raw.length,end=input.selectionEnd??start;
 const formatted=groupMoneyInput(raw);if(formatted===raw)return;
 const significantBefore=pos=>raw.slice(0,pos).replace(/\s/g,'').length;
 const position=count=>{if(count===0)return 0;let seen=0;for(let i=0;i<formatted.length;i++){if(!/\s/.test(formatted[i]))seen++;if(seen===count)return i+1;}return formatted.length;};
 input.value=formatted;input.setSelectionRange(position(significantBefore(start)),position(significantBefore(end)));
}
ids.forEach(id=>{
 const input=$(id),money=id==='price'||id==='down';
 if(money){
  input.addEventListener('beforeinput',event=>{
   const start=input.selectionStart,end=input.selectionEnd;if(start===null||start!==end||event.isComposing)return;
   if(event.inputType==='deleteContentBackward'&&start>0&&/\s/.test(input.value[start-1]))input.setSelectionRange(Math.max(0,start-2),start);
   if(event.inputType==='deleteContentForward'&&/\s/.test(input.value[start]||''))input.setSelectionRange(start,Math.min(input.value.length,start+2));
  });
  input.addEventListener('compositionend',()=>{formatMoneyInput(input);update(submitted)});
 }
 input.addEventListener('input',event=>{if(event.isComposing)return;if(money)formatMoneyInput(input);update(submitted)});
});
$('form').addEventListener('submit',e=>{e.preventDefault();submitted=true;if(update(true))$('card').scrollIntoView({behavior:'smooth',block:'start'});else ids.find(id=>!$(id).value.trim())&&$(ids.find(id=>!$(id).value.trim())).focus()});
function load(src){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Не удалось прочитать изображение.'));i.src=src})}
$('plan').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;const version=++uploadVersion;
 if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>10*1024*1024){$('error').textContent='Выберите PNG, JPG или WEBP размером до 10 МБ.';return}
 uploading=true;update();let url=URL.createObjectURL(f);
 try{const original=await load(url);if(version!==uploadVersion)return;const scale=Math.min(1,2400/Math.max(original.naturalWidth,original.naturalHeight));const c=document.createElement('canvas');c.width=Math.round(original.naturalWidth*scale);c.height=Math.round(original.naturalHeight*scale);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(original,0,0,c.width,c.height);const normalized=c.toDataURL('image/png');const ready=await load(normalized);if(version!==uploadVersion)return;planImage=ready;$('plan-preview').src=normalized;$('plan-preview').hidden=false;$('placeholder').hidden=true;$('upload-name').textContent=f.name;$('upload-hint').textContent='Планировка добавлена · нажмите, чтобы заменить';$('error').textContent='';}
 catch(err){$('error').textContent='Не удалось открыть изображение. Выберите другой файл.';}
 finally{URL.revokeObjectURL(url);if(version===uploadVersion){uploading=false;$('download').disabled=false;schedulePrepare();$('status').textContent=valid?'Карточку можно сохранить и отправить клиенту.':'Заполните параметры, чтобы сохранить карточку.'}}
});

const cardBackdrop=new Image();cardBackdrop.onload=()=>{prepared=null;};cardBackdrop.src='assets/interior-background.png';
const logoAsset=new Image(),avatarAsset=new Image();
for(const asset of [logoAsset,avatarAsset])asset.onload=()=>{prepared=null;};
logoAsset.src='assets/levykin-logo-v2.png';avatarAsset.src='assets/alexander-levykin.png';
function canvasCard(v,img){
 const c=document.createElement('canvas');c.width=1080;c.height=1740;const x=c.getContext('2d');if(!x)throw Error('Ваш браузер не смог создать изображение.');
 const rect=(a,b,w,h,color)=>{x.fillStyle=color;x.fillRect(a,b,w,h)};
 const backdrop=(y,h,overlay)=>{if(!cardBackdrop.complete||!cardBackdrop.naturalWidth)return;x.save();x.beginPath();x.rect(0,y,1080,h);x.clip();const scale=1080/cardBackdrop.naturalWidth;x.drawImage(cardBackdrop,0,y-cardBackdrop.naturalHeight*scale*.32,1080,cardBackdrop.naturalHeight*scale);rect(0,y,1080,h,overlay);x.restore();};
 const text=(s,left,y,size=30,color='#fff',weight=400,align='left',max=970)=>{x.font=`${weight} ${size}px Arial, sans-serif`;while(x.measureText(s).width>max&&size>16){size--;x.font=`${weight} ${size}px Arial, sans-serif`}x.fillStyle=color;x.textAlign=align;x.fillText(s,left,y)};
 rect(0,0,1080,1740,'#141519');rect(0,0,1080,220,'#161619');const logoScale=Math.min(330/logoAsset.naturalWidth,190/logoAsset.naturalHeight);x.drawImage(logoAsset,50,15,logoAsset.naturalWidth*logoScale,logoAsset.naturalHeight*logoScale);rect(668,65,362,98,'#79151c');rect(668,65,4,98,'#e4c5b0');text('ИПОТЕЧНЫЙ',850,106,25,'#fff',600,'center');text('РАСЧЁТ',850,141,25,'#fff',600,'center');
 rect(0,220,1080,545,'#fff');
 if(img){const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;const bw=1020,bh=505,s=Math.min(bw/iw,bh/ih);x.drawImage(img,30+(bw-iw*s)/2,240+(bh-ih*s)/2,iw*s,ih*s)}else{text('Планировка квартиры',540,458,31,'#998d84',400,'center')}
 const gradient=x.createLinearGradient(0,765,1080,990);gradient.addColorStop(0,'#6b1117');gradient.addColorStop(.6,'#b21920');gradient.addColorStop(1,'#690c12');rect(0,765,1080,225,gradient);backdrop(765,225,'#880e16dd');text('Ежемесячный платёж',50,827,28,'#fff1e7');text('ИПОТЕКА',1030,827,22,'#fff1e7',600,'right');text(rub(v.payment),50,931,80,'#fff',700,'left',780);text('в месяц',1030,927,25,'#ead2c5',400,'right');
 rect(40,1020,1000,95,'#232428');text('Стоимость недвижимости',65,1079,27,'#c1b7ae');text(rub(v.price),1015,1080,38,'#fff',600,'right',470);
 const box=(left,top,label,value,accent=false)=>{rect(left,top,485,117,'#232428');text(label,left+24,top+39,24,'#c1b7ae');text(value,left+24,top+86,37,accent?'#e4c5b0':'#fff',600,'left',440)};
 box(40,1133,'Первоначальный взнос',rub(v.down));box(555,1133,'Сумма кредита',rub(v.loan));box(40,1268,'Процентная ставка',v.rate.toLocaleString('ru-RU')+' %',true);box(555,1268,'Срок кредита',v.months+' мес.',true);
 rect(40,1410,1000,1,'#39302b');text('Ваш персональный менеджер',50,1462,24,'#ab9d93');text('Левыкин Александр',50,1517,40,'#fff',600);text('+7 (918) 231-84-48',50,1571,33,'#e1d7cf',500);
 const portraitX=770,portraitY=1430,portraitSize=215;const aw=avatarAsset.naturalWidth,ah=avatarAsset.naturalHeight;x.save();x.beginPath();x.arc(portraitX+portraitSize/2,portraitY+portraitSize/2,portraitSize/2,0,Math.PI*2);x.clip();x.drawImage(avatarAsset,aw*.1875,aw*.16,aw*.50,aw*.50,portraitX,portraitY,portraitSize,portraitSize);x.restore();x.strokeStyle='#d0a990';x.lineWidth=3;x.beginPath();x.arc(portraitX+portraitSize/2,portraitY+portraitSize/2,portraitSize/2-1.5,0,Math.PI*2);x.stroke();
 text('Предварительный расчёт, не является публичной офертой.',50,1697,23,'#a49991');return c;
}
function notify(message){$('status').textContent=message;$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000)}
function fingerprint(){return ids.map(id=>$(id).value).join('|')+'|'+uploadVersion}
function schedulePrepare(){clearTimeout(prepareTimer);prepared=null;if(valid&&!uploading)prepareTimer=setTimeout(()=>{try{prepare()}catch(e){console.error('Подготовка PNG:',e)}},180)}
function prepare(){
 const v=readValues();if(v.error)throw Error(v.error);if(uploading)throw Error('Дождитесь загрузки планировки.');const key=fingerprint();if(prepared?.key===key)return prepared;
 if(!logoAsset.complete||!logoAsset.naturalWidth||!avatarAsset.complete||!avatarAsset.naturalWidth)throw Error('Логотип и фотография ещё загружаются. Повторите сохранение через несколько секунд.');
 const canvas=canvasCard(v,planImage),dataURL=canvas.toDataURL('image/png');if(!dataURL.startsWith('data:image/png;base64,'))throw Error('Не удалось создать PNG.');
 const binary=atob(dataURL.split(',')[1]),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 const blob=new Blob([bytes],{type:'image/png'});prepared={key,dataURL,blob};return prepared;
}
let exportURL=null;
function showExport(p,help){if(exportURL)URL.revokeObjectURL(exportURL);exportURL=URL.createObjectURL(p.blob);$('export-image').src=p.dataURL;$('export-save').href=exportURL;$('export-help').textContent=help||'Скачайте PNG или сохраните картинку через меню изображения.';if(!$('export-dialog').open)$('export-dialog').showModal()}
function readyForAction(){try{return prepare()}catch(e){submitted=true;update(true);notify(e.message||'Не удалось подготовить карточку.');if(readValues().error)$('form').scrollIntoView({behavior:'smooth',block:'center'});return null}}
async function savePNG(p){
 if(typeof window.showSaveFilePicker==='function'&&window.self===window.top){
  try{const handle=await window.showSaveFilePicker({suggestedName:'ipoteka-aleksandr-levykin.png',types:[{description:'Изображение PNG',accept:{'image/png':['.png']}}]});const stream=await handle.createWritable();await stream.write(p.blob);await stream.close();notify('PNG сохранён.');return;}catch(e){if(e.name==='AbortError')return;}
 }
 const link=document.createElement('a');link.href=exportURL;link.download='ipoteka-aleksandr-levykin.png';document.body.append(link);link.click();link.remove();
 $('export-help').textContent='Если загрузка не началась, сохраните картинку через её меню или откройте калькулятор в отдельной вкладке.';
}
$('download').onclick=()=>{const p=readyForAction();if(!p)return;showExport(p);savePNG(p).catch(()=>notify('Картинка готова. Сохраните её через меню изображения.'))};
$('export-save').addEventListener('click',e=>{e.preventDefault();const p=readyForAction();if(p)savePNG(p).catch(()=>notify('Сохраните картинку через меню изображения.'))});
$('export-close').onclick=()=>$('export-dialog').close();$('export-dialog').addEventListener('click',e=>{if(e.target===$('export-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
update();
