import { Module } from '../../core/interfaces/module.js';

function call(target, names, ...args) { for (const name of names) { try { if (typeof target?.[name] === 'function') { const value = target[name](...args); if (value != null) return value; } } catch {} } return null; }
function bearing(dx, dy) { const degrees = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360; return { degrees, direction: ['N','NE','E','SE','S','SW','W','NW'][Math.round(degrees / 45) % 8] }; }

export class WorldToolsModule extends Module {
  constructor() { super({ id:'world-tools', name:'World Map Tools', version:'1.0.0', apiVersion:'1.0.0', author:'ProfessorSr', description:'Coordinate navigation, compasses, sector HUD, zoom, and regional object inspection.', permissions:['game','settings','windows'], settings:{ zoom:{type:'number',default:1,min:0.2,max:3} } }); this.record=null; }
  async enable(context) { this.context=context; }
  root() { return this.context?.hub?.game?.services?.tryGet?.('clientLib')?.root ?? globalThis.ClientLib; }
  state() {
    const root=this.root(), main=root?.Data?.MainData?.GetInstance?.(), cities=call(main,['get_Cities']), city=call(cities,['get_CurrentOwnCity']), vis=root?.Vis?.VisMain?.GetInstance?.(), region=call(vis,['get_Region']);
    const origin={x:Number(call(city,['get_PosX'])??0),y:Number(call(city,['get_PosY'])??0)};
    const center={x:Number(call(region,['get_CenterGridX','get_CenterX'])??origin.x),y:Number(call(region,['get_CenterGridY','get_CenterY'])??origin.y)};
    const world=call(main,['get_World']); const server=call(main,['get_Server']); const width=Number(call(world,['get_WorldWidth','get_Width'])??1000), height=Number(call(world,['get_WorldHeight','get_Height'])??1000);
    const moveEnd=Number(call(city,['get_MoveCooldownEndStep','get_MoveEndStep'])??0), currentStep=Number(call(call(main,['get_Time']),['get_ServerStep','GetCurrentStep'])??0), stepsPerHour=Number(call(server,['get_StepsPerHour'])??3600), moveSeconds=Math.max(0,(moveEnd-currentStep)/Math.max(1,stepsPerHour)*3600);
    const angle=bearing(center.x-width/2,center.y-height/2); return {root,vis,region,origin,center,width,height,sector:angle.direction,world,maxAttackDistance:Number(call(server,['get_MaxAttackDistance'])??0),moveSeconds,moveCompleteAt:moveSeconds?Date.now()+moveSeconds*1000:0};
  }
  focus(x,y) { const {vis}=this.state(); vis?.CenterGridPosition?.(x,y); vis?.Update?.(); vis?.ViewUpdate?.(); }
  build() {
    const qx=globalThis.qx, root=new qx.ui.container.Composite(new qx.ui.layout.VBox(8)).set({padding:10,textColor:'#fff'}), row=new qx.ui.container.Composite(new qx.ui.layout.HBox(6));
    this.x=new qx.ui.form.Spinner(0,0,9999).set({width:80}); this.y=new qx.ui.form.Spinner(0,0,9999).set({width:80}); const go=new qx.ui.form.Button('Focus Coordinates');
    row.add(new qx.ui.basic.Label('X').set({textColor:'#fff',alignY:'middle'}));row.add(this.x);row.add(new qx.ui.basic.Label('Y').set({textColor:'#fff',alignY:'middle'}));row.add(this.y);row.add(go);
    const current=new qx.ui.form.Button('Use Current Base'); const center=new qx.ui.form.Button('Use Screen Center');row.add(current);row.add(center);root.add(row);
    const zoomRow=new qx.ui.container.Composite(new qx.ui.layout.HBox(6)); zoomRow.add(new qx.ui.basic.Label('World zoom').set({textColor:'#fff',alignY:'middle'})); this.zoom=new qx.ui.form.Slider().set({minimum:20,maximum:300,width:260,value:Math.round(this.context.moduleSettings.get('zoom',1)*100)}); zoomRow.add(this.zoom); root.add(zoomRow);
    this.info=new qx.ui.basic.Label('').set({rich:true,wrap:true,textColor:'#fff'});root.add(this.info,{flex:1});
    const refresh=()=>this.render(); go.addListener('execute',()=>{this.focus(this.x.getValue(),this.y.getValue());refresh();}); current.addListener('execute',()=>{const s=this.state();this.x.setValue(s.origin.x);this.y.setValue(s.origin.y);refresh();}); center.addListener('execute',()=>{const s=this.state();this.x.setValue(s.center.x);this.y.setValue(s.center.y);refresh();});
    this.zoom.addListener('changeValue',()=>{const value=this.zoom.getValue()/100;void this.context.moduleSettings.set('zoom',value);const region=this.state().region;call(region,['set_ZoomFactor','setZoomFactor'],value);}); refresh(); return root;
  }
  render(){if(!this.info)return;const s=this.state(), target={x:Number(this.x?.getValue?.()??s.center.x),y:Number(this.y?.getValue?.()??s.center.y)}, fromBase=bearing(target.x-s.origin.x,target.y-s.origin.y), fromCenter=bearing(target.x-s.center.x,target.y-s.center.y),levels=new Map();for(let y=Math.floor(target.y-s.maxAttackDistance);y<=Math.ceil(target.y+s.maxAttackDistance);y+=1)for(let x=Math.floor(target.x-s.maxAttackDistance);x<=Math.ceil(target.x+s.maxAttackDistance);x+=1){if(Math.hypot(x-target.x,y-target.y)>s.maxAttackDistance)continue;const object=s.world?.GetObjectFromPosition?.(x,y),type=Number(call(object,['get_Type','get_ObjectType'])??object?.Type??0);if(type!==2)continue;const level=Number(call(object,['get_BaseLevel','get_Level'])??0);levels.set(level,(levels.get(level)??0)+1);}const total=[...levels.values()].reduce((sum,count)=>sum+count,0),distribution=[...levels].sort((a,b)=>a[0]-b[0]).map(([level,count])=>`${count}× L${level}`).join(', ')||'none';this.info.setValue(`<b>Viewed sector:</b> ${s.sector}<br><b>Current base:</b> ${s.origin.x}:${s.origin.y}<br><b>Screen center:</b> ${s.center.x.toFixed(1)}:${s.center.y.toFixed(1)}<br><b>Move cooldown:</b> ${s.moveSeconds?`${Math.ceil(s.moveSeconds)}s · completes ${new Date(s.moveCompleteAt).toLocaleString()}`:'ready'}<br><br><b>Base compass:</b> ${fromBase.direction} ${fromBase.degrees.toFixed(0)}° · ${Math.hypot(target.x-s.origin.x,target.y-s.origin.y).toFixed(2)} fields<br><b>Screen compass:</b> ${fromCenter.direction} ${fromCenter.degrees.toFixed(0)}° · ${Math.hypot(target.x-s.center.x,target.y-s.center.y).toFixed(2)} fields<br><br><b>Wave zone at ${target.x}:${target.y}:</b> ${total} Forgotten base(s) · ${Math.ceil(total/4)} wave(s)<br><b>Level distribution:</b> ${distribution}`);}
  async open(context=this.context){if(!this.context)await this.enable(context);if(this.record?.window&&!this.record.window.isDisposed?.()){this.render();this.record.window.open();return this.record;}this.record=await this.context.windows.open({id:'world-tools',title:'World Map Tools',content:this.build(),x:120,y:80,width:620,height:420,resizable:true,singleton:true});return this.record;}
  async disable(context=this.context){context?.windows?.close?.('world-tools');this.record=null;this.context=null;}
}
export default WorldToolsModule;
