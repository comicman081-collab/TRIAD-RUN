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
    const canvas=new OffscreenCanvas(w,h),ctx=canvas.getContext('2d',{willReadFrequently:true}),bitmaps=[];ctx.imageSmoothingQuality='high';
    let minX=w,minY=h,maxX=-1,maxY=-1;
    for(const filter of filters){
      ctx.clearRect(0,0,w,h);ctx.filter=filter.replace(/(-?\d+(?:\.\d+)?)px/g,(_,n)=>`${Number(n)*dpr}px`);
      if(filter!=='none'&&ctx.filter==='none')throw Error('Worker filter unavailable');
      ctx.drawImage(image,(pad+(width-dw)/2)*dpr,(pad+(height-dh)/2)*dpr,dw*dpr,dh*dpr);
      const pixels=ctx.getImageData(0,0,w,h).data;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
      bitmaps.push(canvas.transferToImageBitmap());
    }
    // Use the union across filter states, keeping a transparent texel around
    // every nonzero-alpha pixel. No glow pixel or source resolution is removed.
    const cropX=maxX<0?0:Math.max(0,minX-1),cropY=maxY<0?0:Math.max(0,minY-1),cropWidth=maxX<0?1:Math.min(w,maxX+2)-cropX,cropHeight=maxY<0?1:Math.min(h,maxY+2)-cropY;
    const cropped=await Promise.all(bitmaps.map(bitmap=>createImageBitmap(bitmap,cropX,cropY,cropWidth,cropHeight)));bitmaps.forEach(bitmap=>bitmap.close());
    postMessage({id,bitmaps:cropped,contentWidth:dw,contentHeight:dh,cropX,cropY,cropWidth,cropHeight,bytes:cropWidth*cropHeight*4*cropped.length},cropped);
  }catch(error){if(source&&!source.image)images.delete(src);postMessage({id,error:String(error.message||error)});}
  finally{if(source)source.users--;trimSources();}
};
