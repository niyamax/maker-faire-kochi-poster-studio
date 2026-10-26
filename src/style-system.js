const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const radians=n=>n*Math.PI/180;
export const STYLE_IDS=['original','jostle'];
export function heroForRow(cells,row){
  const group=cells.filter(c=>c.row===row);
  for(const letter of ['O','R','D','A','P','B','M','U']){const found=group.find(c=>c.char===letter);if(found)return found.index;}
  return group[0]?.index;
}
export function styleCell(cell,{style='original',cells=[],gesture,focus,width,height}={}){
  let angle=0,dx=0,dy=0;
  if(style==='jostle')angle=[-3.6,0,3,0,-2.4,0,2.5][(cell.col+cell.row*2)%7];
  if(gesture&&focus){
    if(gesture.kind==='continuous'&&cell.response){const response=cell.response;angle+=response.angle*180/Math.PI;dx+=cell.w*response.x;dy+=cell.h*response.y;}
  }
  const c=Math.cos(radians(angle)),s=Math.sin(radians(angle));
  let e=cell.x+cell.w/2-c*cell.w/2+s*cell.h/2+dx;
  let f=cell.y+cell.h/2-s*cell.w/2-c*cell.h/2+dy;
  const corners=[[0,0],[cell.w,0],[cell.w,cell.h],[0,cell.h]].map(([x,y])=>[c*x-s*y+e,s*x+c*y+f]);
  const left=Math.min(...corners.map(p=>p[0])),right=Math.max(...corners.map(p=>p[0])),top=Math.min(...corners.map(p=>p[1])),bottom=Math.max(...corners.map(p=>p[1]));
  if(Number.isFinite(width)){if(left<1)e+=1-left;if(right>width-1)e-=right-width+1;}
  if(Number.isFinite(height)){if(top<1)f+=1-top;if(bottom>height-1)f-=bottom-height+1;}
  return {matrix:[c,s,-s,c,e,f],angle,seam:style==='jostle'};
}
export function paintLayers(mode,render,info,{fg,bg,weight,scale=1}){
  if(mode==='air'&&render==='line')return [{fill:fg,stroke:fg,width:weight},{fill:bg,stroke:'none',width:0,knockout:true}];
  if(mode==='air')return [...(info.seam?[{fill:bg,stroke:bg,width:2.4/scale,knockout:true}]:[]),{fill:fg,stroke:'none',width:0}];
  return [{fill:render==='solid'?fg:'none',stroke:fg,width:weight}];
}
