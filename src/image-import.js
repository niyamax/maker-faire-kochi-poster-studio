import {MAX_IMAGE_DATA_LENGTH} from './poster-image.js';

/** Decode and re-encode locally: portable pixels, bounded size, no SVG or
 * external image URLs, and no source-file metadata in saved projects. */
export async function importPosterImage(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPG or WebP image.');
  if(file.size>20*1024*1024)throw Error('Choose an image smaller than 20 MB.');
  const url=URL.createObjectURL(file),image=new Image();
  try{
    image.src=url;await image.decode();
    if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>40_000_000)throw Error('Choose an image with fewer than 40 million pixels.');
    const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let hasAlpha=false,left=canvas.width,top=canvas.height,right=-1,bottom=-1;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
      const alpha=pixels[(y*canvas.width+x)*4+3];if(alpha<250)hasAlpha=true;
      if(alpha>8){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    }
    if(right<left)throw Error('This image is completely transparent.');
    let output=canvas;
    if(hasAlpha&&(left>0||top>0||right<canvas.width-1||bottom<canvas.height-1)){
      output=document.createElement('canvas');output.width=right-left+1;output.height=bottom-top+1;
      output.getContext('2d').drawImage(canvas,left,top,output.width,output.height,0,0,output.width,output.height);
    }
    let src=output.toDataURL('image/webp',.88);
    while(src.length>MAX_IMAGE_DATA_LENGTH&&Math.max(output.width,output.height)>600){
      const smaller=document.createElement('canvas');smaller.width=Math.max(1,Math.round(output.width*.8));smaller.height=Math.max(1,Math.round(output.height*.8));
      smaller.getContext('2d').drawImage(output,0,0,smaller.width,smaller.height);output=smaller;src=output.toDataURL('image/webp',.84);
    }
    if(src.length>MAX_IMAGE_DATA_LENGTH)throw Error('This image is too detailed to save. Try a smaller image.');
    return {src,width:output.width,height:output.height,name:file.name,hasAlpha};
  }catch(error){if(error.name==='EncodingError')throw Error('This image could not be opened. Try another PNG, JPG or WebP.');throw error;}
  finally{URL.revokeObjectURL(url);}
}
