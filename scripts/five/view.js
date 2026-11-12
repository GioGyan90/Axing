import {createWebGLView} from './webgl-view.js';
import {createCanvasView} from './canvas-view.js';
export function createView(container){
    let canvas=document.createElement('canvas');canvas.setAttribute('aria-label','八角笼 5v5 足球场');canvas.setAttribute('role','img');
    const context=canvas.getContext('webgl2',{antialias:true})||canvas.getContext('webgl',{antialias:true});
    let view;
    if(context)view=createWebGLView(canvas,context);
    else{canvas=document.createElement('canvas');canvas.setAttribute('aria-label','八角笼 5v5 足球场');canvas.setAttribute('role','img');view=createCanvasView(canvas);}
    container.append(canvas);return view;
}
