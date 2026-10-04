/* Filter authoring images off the input/render thread; transfer RGBA snapshots. */
'use strict';
const images=new Map(),sourceLimit=128*1024*1024;let sourceBytes=0;
function trimSources(){for(const [src,entry]of images){if(sourceBytes<=sourceLimit)break;if(entry.users||!entry.image)continue;entry.image.close?.();sourceBytes-=entry.bytes;images.delete(src);}}
onmessage=async({data})=>{
  const {id,src,width,height,pad,dpr,filters}=data;
  let source;
  try{
    if(!images.has(src)){const entry={users:0,bytes:0,image:null};entry.ready=fetch(src,{cache:'force-cache',credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error('VFX HTTP '+r.status);return r.blob()}).then(blob=>createImageBitmap(blob)).then(image=>{entry.image=image;entry.bytes=image.width*image.height*4;sourceBytes+=entry.bytes;return image});images.set(src,entry);}
    source=images.get(src);source.users++;images.delete(src);images.set(src,source);
    const image=await source.ready,w=Math.ceil((width+pad*2)*dpr),h=Math.ceil((height+pad*2)*dpr);
    const scale=Math.min(width/image.width,height/image.height),dw=image.width*scale,dh=image.height*scale;
    const canvas=new OffscreenCanvas(w,h),ctx=canvas.getContext('2d'),bitmaps=[];ctx.imageSmoothingQuality='high';
    for(const filter of filters){
      ctx.clearRect(0,0,w,h);ctx.filter=filter.replace(/(-?\d+(?:\.\d+)?)px/g,(_,n)=>`${Number(n)*dpr}px`);
      if(filter!=='none'&&ctx.filter==='none')throw Error('Worker filter unavailable');
      ctx.drawImage(image,(pad+(width-dw)/2)*dpr,(pad+(height-dh)/2)*dpr,dw*dpr,dh*dpr);
      bitmaps.push(canvas.transferToImageBitmap());
    }
    postMessage({id,bitmaps,contentWidth:dw,contentHeight:dh,bytes:w*h*4*bitmaps.length},bitmaps);
  }catch(error){if(source&&!source.image)images.delete(src);postMessage({id,error:String(error.message||error)});}
  finally{if(source)source.users--;trimSources();}
};
