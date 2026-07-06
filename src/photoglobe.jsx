import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "./supabase";

// ══════════════════════════════════════════════════════════════
// SAEIRIS — PhotoGlobe v6
// Warm stone theme, Cormorant Garamond, minimal & editorial
// Mobile: bottom sheet pattern | Desktop: sidebar layout
// ══════════════════════════════════════════════════════════════

// ── Palette ──
const C = {
  bg:       "#FDFBF8",
  sidebar:  "#F5F0EB",
  border:   "rgba(200,149,108,0.15)",
  accent:   "#C8956C",
  dark:     "#2A2420",
  muted:    "#8A7A68",
  faint:    "rgba(42,36,32,0.04)",
  error:    "#C0392B",
  font:     "'Cormorant Garamond', serif",
  fontSans: "'DM Sans', system-ui, sans-serif",
};

function timeAgo(ts){if(!ts)return"";const d=Math.floor((Date.now()-new Date(ts).getTime())/864e5);if(d<1)return"Today";if(d===1)return"Yesterday";if(d<30)return d+"d ago";if(d<365)return Math.floor(d/30)+"mo ago";return Math.floor(d/365)+"y ago";}
function fmtDate(ts){if(!ts)return"";return new Date(ts).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"});}

// ── Auth Modal ──
function AuthModal({onClose,onAuth}){
  const[mode,setMode]=useState("login");
  const[email,setEmail]=useState("");const[password,setPassword]=useState("");
  const[username,setUsername]=useState("");const[displayName,setDisplayName]=useState("");
  const[error,setError]=useState(null);const[loading,setLoading]=useState(false);
  const handleSubmit=async()=>{
    setError(null);setLoading(true);
    try{
      if(mode==="login"){const{error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;}
      else{const{error}=await supabase.auth.signUp({email,password,options:{data:{username,display_name:displayName||username}}});if(error)throw error;}
      onAuth();onClose();
    }catch(e){setError(e.message);}
    setLoading(false);
  };
  const iS={background:C.bg,border:`1px solid ${C.border}`,borderRadius:0,padding:"12px 14px",color:C.dark,fontSize:15,outline:"none",width:"100%",fontFamily:C.font};
  const lS={fontSize:10,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:6,display:"block",fontFamily:C.fontSans};
  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(42,36,32,0.4)",backdropFilter:"blur(16px)"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{width:420,maxWidth:"calc(100vw - 32px)",background:C.bg,border:`1px solid ${C.border}`,padding:"40px 36px",boxShadow:"0 40px 100px rgba(42,36,32,0.15)"}}>
        <div style={{fontSize:10,letterSpacing:"0.2em",textTransform:"uppercase",color:C.accent,fontFamily:C.font,marginBottom:8}}>SAEIRIS</div>
        <h3 style={{fontSize:28,fontWeight:300,color:C.dark,margin:"0 0 4px",fontFamily:C.font}}>{mode==="login"?"Welcome Back":"Join the Globe"}</h3>
        <p style={{fontSize:14,color:C.muted,margin:"0 0 28px",fontFamily:C.font,lineHeight:1.6}}>{mode==="login"?"Sign in to upload and like photos.":"Create an account to start sharing your world."}</p>
        {error&&<div style={{background:"rgba(192,57,43,0.06)",border:"1px solid rgba(192,57,43,0.2)",padding:"10px 14px",marginBottom:16,fontSize:13,color:C.error,fontFamily:C.fontSans}}>{error}</div>}
        {mode==="signup"&&<>
          <label><span style={lS}>Username</span><input value={username} onChange={e=>setUsername(e.target.value)} placeholder="johndoe" style={{...iS,marginBottom:14}}/></label>
          <label><span style={lS}>Display Name</span><input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="John Doe" style={{...iS,marginBottom:14}}/></label>
        </>}
        <label><span style={lS}>Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={{...iS,marginBottom:14}}/></label>
        <label><span style={lS}>Password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={{...iS,marginBottom:24}} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/></label>
        <button onClick={handleSubmit} disabled={loading}
          style={{width:"100%",padding:"14px",background:C.dark,color:C.bg,border:"none",fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:16,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:C.fontSans,opacity:loading?0.6:1,transition:"background 0.3s"}}
          onMouseOver={e=>e.currentTarget.style.background=C.accent}
          onMouseOut={e=>e.currentTarget.style.background=C.dark}>
          {loading?"...":(mode==="login"?"Sign In":"Create Account")}
        </button>
        <div style={{textAlign:"center",fontSize:13,color:C.muted,fontFamily:C.fontSans}}>
          {mode==="login"?"Don't have an account? ":"Already have an account? "}
          <button onClick={()=>{setMode(mode==="login"?"signup":"login");setError(null);}} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:C.fontSans}}>
            {mode==="login"?"Sign Up":"Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Crop Overlay ──
function CropOverlay({onCapture, onCancel, globeOuterRef}){
  const overlayRef=useRef();
  // Fixed frame: matches left column proportions of 4:5 card (480 x 1240 at 1080px wide)
  // Display at ~45% scale so it fits on screen
  const FRAME_W=420, FRAME_H=960;
  const [pos,setPos]=useState(null); // initialized on mount
  const dragging=useRef(false);
  const dragStart=useRef(null);
  const posRef=useRef({x:0,y:0});

  useEffect(()=>{
    // Center the frame on mount
    if(overlayRef.current){
      const b=overlayRef.current.getBoundingClientRect();
      const x=Math.max(0,(b.width-FRAME_W)/2);
      const y=Math.max(0,(b.height-FRAME_H)/2);
      setPos({x,y});
      posRef.current={x,y};
    }
  },[]);

  const onDown=(e)=>{
    e.preventDefault();
    e.stopPropagation();
    dragging.current=true;
    const clientX=e.touches?e.touches[0].clientX:e.clientX;
    const clientY=e.touches?e.touches[0].clientY:e.clientY;
    dragStart.current={mx:clientX,my:clientY,px:posRef.current.x,py:posRef.current.y};
  };

  const onMove=(e)=>{
    if(!dragging.current||!dragStart.current) return;
    e.preventDefault();
    const clientX=e.touches?e.touches[0].clientX:e.clientX;
    const clientY=e.touches?e.touches[0].clientY:e.clientY;
    const dx=clientX-dragStart.current.mx;
    const dy=clientY-dragStart.current.my;
    const b=overlayRef.current.getBoundingClientRect();
    const nx=Math.max(0,Math.min(b.width-FRAME_W,dragStart.current.px+dx));
    const ny=Math.max(0,Math.min(b.height-FRAME_H,dragStart.current.py+dy));
    posRef.current={x:nx,y:ny};
    setPos({x:nx,y:ny});
  };

  const onUp=(e)=>{
    dragging.current=false;
  };

  const handleCapture=async()=>{
    if(!pos) return;
    try{
      const {globeRef:gRef}=globeOuterRef.current||{};
      const g=gRef?.current;
      const glCanvas=g?.renderer()?.domElement||document.querySelector('#globe-container canvas');
      if(!glCanvas){onCancel();return;}
      if(g) g.renderer().render(g.scene(),g.camera());
      // Scale from CSS px to actual canvas pixels
      const scaleX=glCanvas.width/glCanvas.offsetWidth;
      const scaleY=glCanvas.height/glCanvas.offsetHeight;
      // The overlay sits over the globe area — get globe canvas position relative to overlay
      const overlayRect=overlayRef.current.getBoundingClientRect();
      const canvasRect=glCanvas.getBoundingClientRect();
      const offsetX=canvasRect.left-overlayRect.left;
      const offsetY=canvasRect.top-overlayRect.top;
      // Frame position relative to the canvas
      const srcX=Math.round((pos.x-offsetX)*scaleX);
      const srcY=Math.round((pos.y-offsetY)*scaleY);
      const srcW=Math.round(FRAME_W*scaleX);
      const srcH=Math.round(FRAME_H*scaleY);
      // Output canvas at exact card left-column dimensions (480x1240)
      const out=document.createElement('canvas');
      out.width=480; out.height=1240;
      const ctx=out.getContext('2d');
      ctx.drawImage(glCanvas,srcX,srcY,srcW,srcH,0,0,480,1240);
      onCapture(out.toDataURL('image/png'));
    }catch(err){console.error('Capture failed:',err);onCancel();}
  };

  return(
    <div ref={overlayRef}
      onMouseMove={onMove} onMouseUp={onUp} onTouchMove={onMove} onTouchEnd={onUp}
      style={{position:"absolute",inset:0,zIndex:200,userSelect:"none",touchAction:"none"}}>
      {/* Dark background */}
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.55)",pointerEvents:"none"}}/>
      {/* Instruction bar */}
      <div style={{position:"absolute",top:20,left:"50%",transform:"translateX(-50%)",background:"rgba(26,20,16,0.92)",padding:"10px 22px",color:"#FDFBF8",fontSize:13,fontFamily:"Arial,sans-serif",letterSpacing:"0.05em",whiteSpace:"nowrap",zIndex:4,border:"1px solid rgba(200,149,108,0.4)",pointerEvents:"none"}}>
        Drag the frame to position it, then click Capture
      </div>
      {/* Cancel */}
      <button onMouseDown={e=>e.stopPropagation()} onClick={onCancel}
        style={{position:"absolute",top:20,right:20,background:"rgba(26,20,16,0.9)",border:"1px solid rgba(200,149,108,0.3)",color:"rgba(245,240,235,0.7)",padding:"8px 16px",fontSize:12,cursor:"pointer",fontFamily:"Arial,sans-serif",letterSpacing:"0.08em",zIndex:5}}>
        Cancel
      </button>
      {/* Fixed frame — draggable */}
      {pos&&(
        <div
          onMouseDown={onDown} onTouchStart={onDown}
          style={{position:"absolute",left:pos.x,top:pos.y,width:FRAME_W,height:FRAME_H,border:"2px solid #C8956C",cursor:"grab",zIndex:3,boxSizing:"border-box",
            boxShadow:"0 0 0 9999px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(200,149,108,0.3)"}}>
          {/* Corner markers */}
          {[[0,0,'nw'],[FRAME_W-12,0,'ne'],[0,FRAME_H-12,'sw'],[FRAME_W-12,FRAME_H-12,'se']].map(([x,y,k])=>(
            <div key={k} style={{position:"absolute",left:x,top:y,width:12,height:12,borderTop:k.includes('n')?'2px solid #C8956C':'none',borderBottom:k.includes('s')?'2px solid #C8956C':'none',borderLeft:k.includes('w')?'2px solid #C8956C':'none',borderRight:k.includes('e')?'2px solid #C8956C':'none'}}/>
          ))}
          {/* Center label */}
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center",pointerEvents:"none"}}>
            <div style={{color:"rgba(200,149,108,0.7)",fontSize:11,fontFamily:"Arial,sans-serif",letterSpacing:"1px",marginBottom:8}}>DRAG TO POSITION</div>
            <button onMouseDown={e=>{e.stopPropagation();}} onClick={handleCapture}
              style={{background:"#C8956C",border:"none",color:"#FDFBF8",padding:"10px 24px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"Arial,sans-serif",letterSpacing:"0.1em",textTransform:"uppercase"}}>
              Capture This Area
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
function GlobeCanvas({photos, selectedId, onSelect, width, height, outerRef}){
  const globeRef = useRef();
  const containerRef = useRef();
  useEffect(()=>{
    if(outerRef) outerRef.current = {globeRef, containerRef};
  },[outerRef]);
  const [GlobeComponent, setGlobeComponent] = useState(null);
  const [dims, setDims] = useState({w: width || window.innerWidth, h: height || window.innerHeight});

  useEffect(()=>{
    // Patch getContext BEFORE globe initializes so Three.js WebGL context has preserveDrawingBuffer
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, attrs){
      if(type==='webgl'||type==='webgl2'){
        attrs = {...(attrs||{}), preserveDrawingBuffer:true};
      }
      return origGetContext.call(this, type, attrs);
    };
    import('react-globe.gl').then(mod=>{
      HTMLCanvasElement.prototype.getContext = origGetContext; // restore immediately after
      setGlobeComponent(()=>mod.default);
    });
  },[]);

  useEffect(()=>{
    const ro = new ResizeObserver(entries=>{
      for(const e of entries) setDims({w:e.contentRect.width, h:e.contentRect.height});
    });
    if(containerRef.current) ro.observe(containerRef.current);
    return ()=>ro.disconnect();
  },[]);

  useEffect(()=>{
    if(!globeRef.current) return;
    const controls = globeRef.current.controls();
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.4;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    globeRef.current.pointOfView({lat:20, lng:-20, altitude:2.2});
    import('three').then(THREE=>{
      const mat = globeRef.current.globeMaterial();
      mat.bumpScale = 12;
      new THREE.TextureLoader().load(
        '//cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png',
        tex=>{ mat.bumpMap = tex; mat.needsUpdate = true; }
      );
      const scene = globeRef.current.scene();
      scene.traverse(obj=>{
        if(obj.isAmbientLight) obj.intensity = 1.4;
        if(obj.isDirectionalLight){ obj.intensity = 1.6; obj.position.set(3,1,2); }
      });
    });
  },[GlobeComponent]);

  const pointsData = useMemo(()=>photos.map(p=>({
    ...p,
    lat: p.lat,
    lng: p.lon,
    size: p.id === selectedId ? 0.45 : 0.25,
    color: '#C8956C',
  })),[photos, selectedId]);

  if(!GlobeComponent) return(
    <div ref={containerRef} style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:"#1C1C1E"}}>
      <div style={{color:C.muted,fontSize:14,fontFamily:C.font,letterSpacing:"0.1em"}}>Loading globe...</div>
    </div>
  );

  return(
    <div ref={containerRef} id="globe-container" style={{width:'100%',height:'100%'}}>
      <GlobeComponent
        ref={globeRef}
        width={dims.w}
        height={dims.h}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="/earth-day-8k.jpg"
        showAtmosphere={true}
        atmosphereColor="#5AAAD4"
        atmosphereAltitude={0.18}
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointRadius="size"
        pointAltitude={0.002}
        pointResolution={12}
        onPointClick={(point)=>onSelect(point.id === selectedId ? null : point.id)}
        onPointHover={(point)=>{document.body.style.cursor = point ? 'pointer' : 'default';}}
      />
    </div>
  );
}

// ── Photo List Item ──
function PhotoListItem({photo, selected, onClick}){
  return(
    <div onClick={onClick} style={{display:"flex",gap:12,padding:"12px 14px",cursor:"pointer",borderBottom:`1px solid ${C.border}`,background:selected?`rgba(200,149,108,0.06)`:"transparent",transition:"background 0.2s"}}
      onMouseOver={e=>!selected&&(e.currentTarget.style.background="rgba(200,149,108,0.03)")}
      onMouseOut={e=>!selected&&(e.currentTarget.style.background="transparent")}>
      <div style={{width:52,height:52,flexShrink:0,borderRadius:4,overflow:"hidden",background:photo.image_url?"transparent":"rgba(200,149,108,0.08)",border:`1px solid ${C.border}`}}>
        {photo.image_url?<img src={photo.image_url} alt={photo.title} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:
        <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="12" cy="12" r="4"/></svg>
        </div>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:15,fontWeight:400,color:C.dark,fontFamily:C.font,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginBottom:2}}>{photo.title}</div>
        <div style={{fontSize:11,color:C.muted,fontFamily:C.fontSans,marginBottom:2}}>{photo.city}, {photo.country}</div>
        <div style={{fontSize:11,color:C.muted,fontFamily:C.fontSans,opacity:0.7}}>{photo.camera}</div>
      </div>
    </div>
  );
}

// ── Instagram Export ──
function buildExportCard(photo,globeDataUrl){
  const W=1080,H=1350,mapW=480,rightW=600,bodyH=H-110;
  const card=document.createElement('div');
  card.style.cssText=`position:fixed;left:-9999px;top:0;width:${W}px;height:${H}px;display:flex;flex-direction:column;font-family:'Cormorant Garamond',Georgia,serif;background:#FDFBF8;overflow:hidden;`;
  const hdr=document.createElement('div');
  hdr.style.cssText=`width:${W}px;height:60px;background:#2A2420;display:flex;align-items:center;justify-content:center;flex-shrink:0;`;
  hdr.innerHTML=`<span style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;color:#C8956C;letter-spacing:8px;">S Æ-1 R I S</span>`;
  card.appendChild(hdr);
  const body=document.createElement('div');
  body.style.cssText=`display:flex;width:${W}px;height:${bodyH}px;overflow:hidden;flex:1;`;
  // Left — globe snapshot
  const mapCol=document.createElement('div');
  mapCol.style.cssText=`width:${mapW}px;height:${bodyH}px;position:relative;background:#1C2535;flex-shrink:0;overflow:hidden;`;
  if(globeDataUrl){const gImg=document.createElement('img');gImg.style.cssText=`width:100%;height:100%;object-fit:cover;object-position:center;`;gImg.src=globeDataUrl;mapCol.appendChild(gImg);}
  const pinSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  pinSvg.setAttribute('width','70');pinSvg.setAttribute('height','70');pinSvg.setAttribute('viewBox','0 0 70 70');
  pinSvg.style.cssText=`position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);`;
  pinSvg.innerHTML=`<circle cx="35" cy="35" r="32" fill="none" stroke="#C8956C" stroke-width="1.5" opacity="0.3"/><circle cx="35" cy="35" r="21" fill="none" stroke="#C8956C" stroke-width="2"/><circle cx="35" cy="35" r="5" fill="#C8956C"/>${[0,45,90,135].map(a=>{const r=Math.PI*a/180;return`<line x1="${(35+Math.cos(r)*22).toFixed(1)}" y1="${(35+Math.sin(r)*22).toFixed(1)}" x2="${(35+Math.cos(r)*31).toFixed(1)}" y2="${(35+Math.sin(r)*31).toFixed(1)}" stroke="#C8956C" stroke-width="1.2" opacity="0.6"/><line x1="${(35-Math.cos(r)*22).toFixed(1)}" y1="${(35-Math.sin(r)*22).toFixed(1)}" x2="${(35-Math.cos(r)*31).toFixed(1)}" y2="${(35-Math.sin(r)*31).toFixed(1)}" stroke="#C8956C" stroke-width="1.2" opacity="0.6"/>`;}).join('')}`;
  mapCol.appendChild(pinSvg);
  const lat=photo.lat||0,lon=photo.lon||0;
  const locLabel=document.createElement('div');
  locLabel.style.cssText=`position:absolute;bottom:24px;left:20px;background:rgba(26,20,16,0.82);padding:10px 16px;`;
  locLabel.innerHTML=`<div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:17px;color:#FDFBF8;">${photo.city||''}, ${photo.country||''}</div><div style="font-family:Arial,sans-serif;font-size:11px;color:#C8956C;letter-spacing:1px;margin-top:3px;">${lat.toFixed(2)}° N · ${Math.abs(lon).toFixed(2)}° ${lon<0?'W':'E'}</div>`;
  mapCol.appendChild(locLabel);
  body.appendChild(mapCol);
  const divEl=document.createElement('div');
  divEl.style.cssText=`width:2px;height:${bodyH}px;background:#C8956C;opacity:0.25;flex-shrink:0;`;
  body.appendChild(divEl);
  // Right column
  const right=document.createElement('div');
  right.style.cssText=`width:${rightW-2}px;height:${bodyH}px;display:flex;flex-direction:column;background:#FDFBF8;overflow:hidden;`;
  // Photo snippet — fixed preview box, crops naturally like detail panel thumbnail
  const photoSnip=document.createElement('div');
  photoSnip.style.cssText=`width:100%;height:280px;position:relative;background:#2A2420;flex-shrink:0;overflow:hidden;`;
  if(photo.image_url){
    const img=document.createElement('img');
    img.crossOrigin='anonymous';
    img.style.cssText=`position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block;`;
    img.src=photo.image_url;
    photoSnip.appendChild(img);
  }
  const photoOverlay=document.createElement('div');
  photoOverlay.style.cssText=`position:absolute;bottom:0;left:0;right:0;padding:16px 20px;background:linear-gradient(to top,rgba(26,20,16,0.88) 0%,transparent 100%);`;
  photoOverlay.innerHTML=`<div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;color:#FDFBF8;margin-bottom:3px;line-height:1.2;">${photo.title||''}</div><div style="font-family:Arial,sans-serif;font-size:10px;color:#C8956C;letter-spacing:1.5px;">${(photo.city||'').toUpperCase()}${photo.country?', '+(photo.country).toUpperCase():''}</div>`;
  photoSnip.appendChild(photoOverlay);
  right.appendChild(photoSnip);
  // Settings
  const settings=document.createElement('div');
  settings.style.cssText=`padding:16px 20px;flex:1;display:flex;flex-direction:column;`;
  const camLabel=document.createElement('div');camLabel.style.cssText=`font-family:Arial,sans-serif;font-size:9px;color:#8A7A68;letter-spacing:2px;margin-bottom:4px;`;camLabel.textContent='CAMERA & LENS';settings.appendChild(camLabel);
  const camVal=document.createElement('div');camVal.style.cssText=`font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;color:#2A2420;margin-bottom:2px;`;camVal.textContent=photo.camera||'—';settings.appendChild(camVal);
  const lensVal=document.createElement('div');lensVal.style.cssText=`font-family:Arial,sans-serif;font-size:11px;color:#8A7A68;margin-bottom:10px;`;lensVal.textContent=`${photo.lens||'—'}${photo.film_type?' · '+photo.film_type:''}`;settings.appendChild(lensVal);
  const sep1=document.createElement('div');sep1.style.cssText=`height:1px;background:#E8DDD4;margin-bottom:10px;`;settings.appendChild(sep1);
  const grid=document.createElement('div');grid.style.cssText=`display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:10px;`;
  [{l:'APERTURE',v:photo.aperture},{l:'SHUTTER',v:photo.shutter_speed},{l:'ISO',v:photo.iso},{l:'FOCAL',v:photo.focal_length},{l:'FLASH',v:photo.flash},{l:'WB',v:photo.white_balance}].forEach(({l,v})=>{const cell=document.createElement('div');cell.style.cssText=`background:#F5F0EB;padding:7px 10px;`;cell.innerHTML=`<div style="font-family:Arial,sans-serif;font-size:7px;color:#8A7A68;letter-spacing:1.5px;margin-bottom:3px;">${l}</div><div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;color:#2A2420;">${v||'—'}</div>`;grid.appendChild(cell);});
  settings.appendChild(grid);
  const sep2=document.createElement('div');sep2.style.cssText=`height:1px;background:#E8DDD4;margin-bottom:8px;`;settings.appendChild(sep2);
  if(photo.tags?.length>0){const tagsEl=document.createElement('div');tagsEl.style.cssText=`font-family:Arial,sans-serif;font-size:10px;color:#8A7A68;line-height:1.9;`;tagsEl.textContent=photo.tags.map(t=>`#${t}`).join('  ');settings.appendChild(tagsEl);}
  right.appendChild(settings);
  body.appendChild(right);
  card.appendChild(body);
  const ftr=document.createElement('div');
  ftr.style.cssText=`width:${W}px;height:50px;background:#2A2420;display:flex;align-items:center;justify-content:center;flex-shrink:0;`;
  ftr.innerHTML=`<span style="font-family:Arial,sans-serif;font-size:11px;color:#C8956C;letter-spacing:3px;">SAEIRIS.COM  ·  @SAE1RIS  ·  PHOTOGLOBE</span>`;
  card.appendChild(ftr);
  return card;
}

// ── Photo Detail ──
function PhotoDetail({photo, onClose, onLike, onDelete, user, getGlobeSnapshot}){
  const[fullscreen,setFullscreen]=useState(false);
  const[confirmDelete,setConfirmDelete]=useState(false);
  const[exporting,setExporting]=useState(false);
  const isOwner = user && photo.user_id === user.id;

  const handleExport=async()=>{
    setExporting(true);
    try{
      const globeDataUrl=getGlobeSnapshot ? await getGlobeSnapshot() : null;
      const {default:html2canvas}=await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js');
      const card=buildExportCard(photo,globeDataUrl);
      document.body.appendChild(card);
      // Wait for all images in the card to fully load before capturing
      const images=Array.from(card.querySelectorAll('img'));
      await Promise.all(images.map(img=>new Promise(resolve=>{
        if(img.complete&&img.naturalHeight!==0) resolve();
        else{ img.onload=resolve; img.onerror=resolve; }
      })));
      await new Promise(r=>setTimeout(r,200));
      const canvas=await html2canvas(card,{width:1080,height:1350,scale:1,useCORS:true,allowTaint:false,backgroundColor:'#FDFBF8',logging:false});
      document.body.removeChild(card);
      const link=document.createElement('a');
      link.download=`saeiris-${(photo.title||'photo').toLowerCase().replace(/\s+/g,'-')}.png`;
      link.href=canvas.toDataURL('image/png');
      link.click();
    }catch(e){console.error('Export failed:',e);}
    setExporting(false);
  };

  if(!photo)return null;
  if(fullscreen&&photo.image_url){
    return(
      <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.95)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}} onClick={()=>setFullscreen(false)}>
        <img src={photo.image_url} alt={photo.title} style={{maxWidth:"95vw",maxHeight:"95vh",objectFit:"contain"}}/>
        <button style={{position:"absolute",top:20,right:20,width:44,height:44,borderRadius:"50%",background:"rgba(255,255,255,0.1)",border:"none",color:"#fff",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
      </div>
    );
  }

  return(
    <div style={{position:"absolute",top:0,right:0,width:400,height:"100%",background:C.bg,borderLeft:`1px solid ${C.border}`,zIndex:100,display:"flex",flexDirection:"column",animation:"slideIn 0.4s cubic-bezier(0.16,1,0.3,1)",overflowY:"auto",boxShadow:"-8px 0 40px rgba(42,36,32,0.08)"}}>
      <div style={{width:"100%",height:240,position:"relative",flexShrink:0,background:photo.image_url?`url(${photo.image_url}) center/cover`:C.sidebar}}>
        {!photo.image_url&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1"><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="12" cy="12" r="4"/></svg></div>}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(42,36,32,0.5) 0%,transparent 50%)"}}/>
        <button onClick={onClose} style={{position:"absolute",top:14,right:14,width:32,height:32,borderRadius:"50%",background:"rgba(42,36,32,0.4)",border:"none",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,backdropFilter:"blur(8px)"}}>×</button>
        {photo.image_url&&<button onClick={()=>setFullscreen(true)} style={{position:"absolute",top:14,right:54,width:32,height:32,borderRadius:"50%",background:"rgba(42,36,32,0.4)",border:"none",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg></button>}
        {photo.film_type&&<div style={{position:"absolute",top:14,left:14,background:"rgba(200,149,108,0.85)",padding:"4px 10px",fontSize:10,color:"#fff",fontWeight:600,letterSpacing:"0.08em",fontFamily:C.fontSans,backdropFilter:"blur(8px)"}}>{photo.film_type}</div>}
      </div>
      <div style={{padding:"20px 24px 32px",flex:1}}>
        <h2 style={{fontSize:24,fontWeight:300,color:C.dark,margin:"0 0 4px",fontFamily:C.font,lineHeight:1.2}}>{photo.title}</h2>
        <div style={{fontSize:13,color:C.muted,fontFamily:C.fontSans,marginBottom:photo.description?12:18}}>{photo.city}, {photo.country} · {timeAgo(photo.created_at||photo.captured_at)}</div>
        {photo.description&&<p style={{fontSize:14,color:"#5A4A38",fontFamily:C.font,lineHeight:1.8,margin:"0 0 18px",fontStyle:"italic"}}>{photo.description}</p>}
        <button onClick={()=>onLike(photo.id)}
          style={{width:"100%",padding:"10px",border:`1px solid ${photo.user_liked?"rgba(200,149,108,0.4)":C.border}`,background:photo.user_liked?"rgba(200,149,108,0.08)":"transparent",color:photo.user_liked?C.accent:C.muted,fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:16,transition:"all 0.2s",fontFamily:C.fontSans,letterSpacing:"0.06em"}}>
          {photo.user_liked?"♥":"♡"} {photo.like_count||0} {photo.like_count===1?"like":"likes"}
        </button>
        <button onClick={handleExport} disabled={exporting}
          style={{width:"100%",padding:"10px",border:`1px solid ${C.border}`,background:"transparent",color:exporting?C.muted:C.dark,fontSize:12,fontWeight:600,cursor:exporting?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:16,transition:"all 0.2s",fontFamily:C.fontSans,letterSpacing:"0.08em",textTransform:"uppercase",opacity:exporting?0.6:1}}
          onMouseOver={e=>!exporting&&(e.currentTarget.style.background=C.faint)}
          onMouseOut={e=>e.currentTarget.style.background="transparent"}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {exporting?"Exporting...":"Export for Instagram"}
        </button>
        {isOwner&&(
          confirmDelete?(
            <div style={{marginBottom:16,padding:"14px",background:"rgba(192,57,43,0.04)",border:"1px solid rgba(192,57,43,0.15)"}}>
              <div style={{fontSize:13,color:C.dark,fontFamily:C.font,marginBottom:12,lineHeight:1.5}}>Are you sure? This cannot be undone.</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>onDelete(photo.id)} style={{flex:1,padding:"9px",background:C.error,color:"#fff",border:"none",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:C.fontSans,letterSpacing:"0.08em",textTransform:"uppercase"}}>Delete</button>
                <button onClick={()=>setConfirmDelete(false)} style={{flex:1,padding:"9px",background:"transparent",color:C.muted,border:`1px solid ${C.border}`,fontSize:12,cursor:"pointer",fontFamily:C.fontSans}}>Cancel</button>
              </div>
            </div>
          ):(
            <button onClick={()=>setConfirmDelete(true)}
              style={{width:"100%",padding:"9px",border:"1px solid rgba(192,57,43,0.2)",background:"transparent",color:"rgba(192,57,43,0.7)",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:16,transition:"all 0.2s",fontFamily:C.fontSans,letterSpacing:"0.08em",textTransform:"uppercase"}}
              onMouseOver={e=>{e.currentTarget.style.background="rgba(192,57,43,0.04)";e.currentTarget.style.borderColor="rgba(192,57,43,0.4)";}}
              onMouseOut={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="rgba(192,57,43,0.2)";}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              Delete Photo
            </button>
          )
        )}
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:C.sidebar,marginBottom:20,border:`1px solid ${C.border}`}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:600,fontSize:14,color:"#fff",fontFamily:C.fontSans,flexShrink:0}}>{(photo.photographer_name||"?").charAt(0).toUpperCase()}</div>
          <div>
            <div style={{fontSize:15,fontWeight:400,color:C.dark,fontFamily:C.font}}>{photo.photographer_name||"Unknown"}</div>
            <div style={{fontSize:11,color:C.muted,fontFamily:C.fontSans}}>@{photo.photographer_username||"user"}</div>
          </div>
        </div>
        <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:600,marginBottom:8,fontFamily:C.fontSans}}>Camera & Lens</div>
        <div style={{padding:"12px 14px",background:C.sidebar,border:`1px solid ${C.border}`,marginBottom:16}}>
          <div style={{fontSize:16,fontWeight:400,color:C.accent,fontFamily:C.font,marginBottom:2}}>{photo.camera}</div>
          <div style={{fontSize:13,color:C.muted,fontFamily:C.fontSans}}>{photo.lens||"—"}</div>
          {photo.film_type&&<div style={{fontSize:12,color:C.muted,fontFamily:C.fontSans,marginTop:4}}>Film: {photo.film_type}</div>}
        </div>
        <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:600,marginBottom:8,fontFamily:C.fontSans}}>Settings</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:16}}>
          {[{l:"Aperture",v:photo.aperture},{l:"Shutter",v:photo.shutter_speed},{l:"ISO",v:photo.iso},{l:"Focal",v:photo.focal_length},{l:"Flash",v:photo.flash},{l:"WB",v:photo.white_balance}].map(b=>
            <div key={b.l} style={{background:C.sidebar,padding:"9px 12px",border:`1px solid ${C.border}`}}>
              <span style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,fontFamily:C.fontSans}}>{b.l}</span>
              <div style={{fontSize:14,color:C.dark,fontWeight:400,fontFamily:C.font,marginTop:2}}>{b.v||"—"}</div>
            </div>
          )}
        </div>
        {photo.tags?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>
          {photo.tags.map(t=><span key={t} style={{padding:"4px 10px",fontSize:11,fontWeight:500,background:"transparent",color:C.muted,border:`1px solid ${C.border}`,fontFamily:C.fontSans}}>#{t}</span>)}
        </div>}
        <div style={{fontSize:12,color:C.muted,borderTop:`1px solid ${C.border}`,paddingTop:12,fontFamily:C.fontSans}}>{photo.captured_at?"Captured "+fmtDate(photo.captured_at):"Uploaded "+fmtDate(photo.created_at)}</div>
      </div>
    </div>
  );
}

// ── Location Search ──
function LocationSearch({onSelect,style}){
  const[query,setQuery]=useState("");const[results,setResults]=useState([]);const[loading,setLoading]=useState(false);const[selected,setSelected]=useState(null);
  const debounceRef=useRef(null);
  const search=useCallback((q)=>{
    if(q.length<2){setResults([]);return;}setLoading(true);
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`,{headers:{"Accept-Language":"en"}})
      .then(r=>r.json()).then(data=>{setResults(data.map(d=>{const city=d.address?.city||d.address?.town||d.address?.village||d.address?.hamlet||d.address?.municipality||d.address?.county||"";return{display:d.display_name,lat:parseFloat(d.lat),lon:parseFloat(d.lon),city,state:d.address?.state||"",country:d.address?.country||""};
      }));setLoading(false);}).catch(()=>setLoading(false));
  },[]);
  const handleChange=(e)=>{const v=e.target.value;setQuery(v);setSelected(null);if(debounceRef.current)clearTimeout(debounceRef.current);debounceRef.current=setTimeout(()=>search(v),350);};
  const handleSelect=(r)=>{setSelected(r);setQuery(r.display);setResults([]);onSelect(r);};
  return(
    <div style={{position:"relative",marginBottom:14}}>
      <div style={{position:"relative"}}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <input value={query} onChange={handleChange} placeholder="Search a city or address..." style={{...style,paddingLeft:36}}/>
        {loading&&<div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:12,color:C.muted}}>...</div>}
      </div>
      {selected&&<div style={{marginTop:8,padding:"8px 12px",background:"rgba(200,149,108,0.06)",border:`1px solid ${C.border}`,fontSize:12,color:C.accent,fontFamily:C.fontSans,display:"flex",alignItems:"center",gap:6}}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        {selected.city}{selected.state?`, ${selected.state}`:""}, {selected.country}
      </div>}
      {results.length>0&&!selected&&<div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:10,background:C.bg,border:`1px solid ${C.border}`,marginTop:2,overflow:"hidden",boxShadow:"0 12px 40px rgba(42,36,32,0.1)",maxHeight:220,overflowY:"auto"}}>
        {results.map((r,i)=><div key={i} onClick={()=>handleSelect(r)} style={{padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${C.border}`,fontSize:13,color:C.dark,fontFamily:C.fontSans,display:"flex",alignItems:"flex-start",gap:8}} onMouseOver={e=>e.currentTarget.style.background=C.faint} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" style={{marginTop:2,flexShrink:0}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <div style={{minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.display}</div>
        </div>)}
      </div>}
    </div>
  );
}

// ── Upload Modal ──
function UploadModal({onClose,onUpload,user}){
  const[imgFile,setImgFile]=useState(null);const[imgPreview,setImgPreview]=useState(null);
  const[title,setTitle]=useState("");const[description,setDescription]=useState("");const[lat,setLat]=useState("");const[lon,setLon]=useState("");
  const[city,setCity]=useState("");const[country,setCountry]=useState("");
  const[camera,setCamera]=useState("");const[lens,setLens]=useState("");const[filmType,setFilmType]=useState("");
  const[aperture,setAperture]=useState("");const[shutter,setShutter]=useState("");const[iso,setIso]=useState("");
  const[focalLength,setFocalLength]=useState("");const[tags,setTags]=useState("");
  const[location,setLocation]=useState(null);
  const handleLocation=(loc)=>{setLocation(loc);setLat(loc.lat.toString());setLon(loc.lon.toString());setCity(loc.city||loc.state||"Unknown");setCountry(loc.country||"Unknown");};
  const[step,setStep]=useState(1);const[uploading,setUploading]=useState(false);const[success,setSuccess]=useState(false);const[error,setError]=useState(null);
  const fileRef=useRef(null);
  const handleFile=(f)=>{
    if(!f)return;
    if(f.size>20*1024*1024){setError("File size exceeds 20MB. Please upload a smaller image.");return;}
    setError(null);setImgFile(f);setImgPreview(URL.createObjectURL(f));
  };
  const handleSubmit=async()=>{
    setUploading(true);setError(null);
    try{
      let image_url=null;
      if(imgFile){const ext=imgFile.name.split('.').pop();const path=`${user.id}/${Date.now()}.${ext}`;const{error:uploadErr}=await supabase.storage.from('photos').upload(path,imgFile);if(uploadErr)throw uploadErr;const{data}=supabase.storage.from('photos').getPublicUrl(path);image_url=data.publicUrl;}
      const{error:insertErr}=await supabase.from('photos').insert({user_id:user.id,title,description:description||null,lat:parseFloat(lat),lon:parseFloat(lon),city,country,image_url,camera,lens:lens||null,film_type:filmType||null,aperture:aperture||null,shutter_speed:shutter||null,iso:iso||null,focal_length:focalLength||null,flash:"Off",white_balance:"Auto",tags:tags.split(",").map(t=>t.trim().toLowerCase()).filter(Boolean),captured_at:new Date().toISOString()});
      if(insertErr)throw insertErr;
      setSuccess(true);onUpload();setTimeout(onClose,1500);
    }catch(e){setError(e.message);}
    setUploading(false);
  };
  const iS={background:C.sidebar,border:`1px solid ${C.border}`,borderRadius:0,padding:"11px 14px",color:C.dark,fontSize:14,outline:"none",width:"100%",fontFamily:C.font};
  const lS={fontSize:10,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6,display:"block",fontFamily:C.fontSans};
  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(42,36,32,0.4)",backdropFilter:"blur(16px)"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{width:560,maxWidth:"calc(100vw - 32px)",maxHeight:"92vh",background:C.bg,border:`1px solid ${C.border}`,overflow:"hidden",boxShadow:"0 40px 100px rgba(42,36,32,0.15)",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"24px 28px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,borderBottom:`1px solid ${C.border}`}}>
          <div>
            <div style={{fontSize:10,letterSpacing:"0.2em",textTransform:"uppercase",color:C.accent,fontFamily:C.font,marginBottom:4}}>SAEIRIS</div>
            <h3 style={{fontSize:22,fontWeight:300,color:C.dark,margin:0,fontFamily:C.font}}>{success?"Published to the Globe":"Upload Photo"}</h3>
            <p style={{fontSize:12,color:C.muted,margin:"4px 0 0",fontFamily:C.fontSans}}>{success?"Your photo is now on the globe":step===1?"Photo & location":"Camera details"}</p>
          </div>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:"50%",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        {!success&&<div style={{display:"flex",gap:0,padding:"0",flexShrink:0}}>
          {[1,2].map(s=><div key={s} style={{flex:1,height:2,background:step>=s?C.accent:C.border,transition:"all 0.3s"}}/>)}
        </div>}
        <div style={{padding:"24px 28px 28px",overflowY:"auto",flex:1}}>
          {error&&<div style={{background:"rgba(192,57,43,0.04)",border:"1px solid rgba(192,57,43,0.15)",padding:"10px 14px",marginBottom:16,fontSize:13,color:C.error,fontFamily:C.fontSans}}>{error}</div>}
          {success?(
            <div style={{textAlign:"center",padding:"48px 0"}}>
              <div style={{width:56,height:56,border:`1px solid ${C.accent}`,margin:"0 auto 20px",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.5"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div style={{fontSize:22,fontWeight:300,color:C.dark,fontFamily:C.font}}>Published to the Globe</div>
              <div style={{fontSize:13,color:C.muted,fontFamily:C.fontSans,marginTop:8}}>Your photo is now visible to everyone.</div>
            </div>
          ):step===1?(
            <div>
              <div onClick={()=>fileRef.current?.click()} style={{border:`1px dashed ${imgPreview?C.accent:C.border}`,height:imgPreview?200:130,cursor:"pointer",background:imgPreview?`url(${imgPreview}) center/cover`:C.sidebar,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:20,position:"relative",overflow:"hidden"}}>
                <input ref={fileRef} type="file" accept="image/*" onChange={e=>handleFile(e.target.files?.[0])} style={{display:"none"}}/>
                {!imgPreview&&<div style={{textAlign:"center"}}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                  <div style={{fontSize:13,color:C.muted,marginTop:8,fontFamily:C.fontSans}}>Click to add photo · Max 20MB</div>
                </div>}
              </div>
              <label><span style={lS}>Photo Title *</span><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Name your photo" style={{...iS,marginBottom:14}}/></label>
              <label><span style={lS}>Description</span><textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Tell the story behind this photo..." rows={3} style={{...iS,marginBottom:14,resize:"none",lineHeight:1.6}}/></label>
              <label><span style={lS}>Location *</span></label>
              <LocationSearch onSelect={handleLocation} style={iS}/>
              <label><span style={lS}>Tags (comma separated)</span><input value={tags} onChange={e=>setTags(e.target.value)} placeholder="landscape, film, travel" style={{...iS,marginBottom:6}}/></label>
              <button onClick={()=>setStep(2)} disabled={!title||!location}
                style={{width:"100%",padding:"13px",background:(!title||!location)?C.border:C.dark,color:(!title||!location)?C.muted:"#fff",border:"none",fontSize:12,fontWeight:600,cursor:(!title||!location)?"default":"pointer",marginTop:16,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:C.fontSans,transition:"background 0.3s"}}
                onMouseOver={e=>{if(title&&location)e.currentTarget.style.background=C.accent;}}
                onMouseOut={e=>{if(title&&location)e.currentTarget.style.background=C.dark;}}>
                Continue →
              </button>
            </div>
          ):(
            <div>
              <label><span style={lS}>Camera *</span><input value={camera} onChange={e=>setCamera(e.target.value)} placeholder="Canon AE-1" style={{...iS,marginBottom:14}}/></label>
              <label><span style={lS}>Lens</span><input value={lens} onChange={e=>setLens(e.target.value)} placeholder="50mm f/1.8" style={{...iS,marginBottom:14}}/></label>
              <label><span style={lS}>Film Type</span><input value={filmType} onChange={e=>setFilmType(e.target.value)} placeholder="Kodak UltraMax 400" style={{...iS,marginBottom:14}}/></label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                <label><span style={lS}>Aperture</span><input value={aperture} onChange={e=>setAperture(e.target.value)} placeholder="f/2.8" style={iS}/></label>
                <label><span style={lS}>Shutter Speed</span><input value={shutter} onChange={e=>setShutter(e.target.value)} placeholder="1/250" style={iS}/></label>
                <label><span style={lS}>ISO</span><input value={iso} onChange={e=>setIso(e.target.value)} placeholder="400" style={iS}/></label>
                <label><span style={lS}>Focal Length</span><input value={focalLength} onChange={e=>setFocalLength(e.target.value)} placeholder="50mm" style={iS}/></label>
              </div>
              <div style={{display:"flex",gap:10,marginTop:8}}>
                <button onClick={()=>setStep(1)} style={{flex:1,padding:"12px",background:"transparent",color:C.muted,border:`1px solid ${C.border}`,fontSize:12,cursor:"pointer",fontFamily:C.fontSans}}>← Back</button>
                <button onClick={handleSubmit} disabled={uploading||!camera}
                  style={{flex:2,padding:"12px",background:(!camera)?C.border:C.dark,color:(!camera)?C.muted:"#fff",border:"none",fontSize:12,fontWeight:600,cursor:(!camera)?"default":"pointer",letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:C.fontSans,transition:"background 0.3s"}}
                  onMouseOver={e=>{if(camera&&!uploading)e.currentTarget.style.background=C.accent;}}
                  onMouseOut={e=>{if(camera&&!uploading)e.currentTarget.style.background=C.dark;}}>
                  {uploading?"Uploading...":"Publish to Globe"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Globe Nav (desktop) ──
function GlobeNav({onNavigate}){
  return(
    <div style={{position:"absolute",top:20,right:20,zIndex:40,display:"flex",gap:8}}>
      <button onClick={()=>onNavigate("home")}
        style={{padding:"8px 18px",background:"rgba(28,28,30,0.8)",border:`1px solid rgba(200,149,108,0.25)`,color:"rgba(245,240,235,0.6)",fontSize:11,cursor:"pointer",fontFamily:C.fontSans,letterSpacing:"0.1em",textTransform:"uppercase",backdropFilter:"blur(12px)",transition:"all 0.2s"}}
        onMouseOver={e=>{e.currentTarget.style.color="#F5F0EB";}}
        onMouseOut={e=>{e.currentTarget.style.color="rgba(245,240,235,0.6)";}}>
        ← Back to Site
      </button>
      <button style={{padding:"8px 18px",background:C.accent,border:"none",color:"#fff",fontSize:11,cursor:"default",fontFamily:C.fontSans,letterSpacing:"0.1em",textTransform:"uppercase"}}>Globe</button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MOBILE BOTTOM SHEET GLOBE
// ══════════════════════════════════════════════════════════════

// ── Mobile Photo Detail Sheet ──
// Slides up over the panel when a photo pin is tapped
function MobilePhotoDetail({photo, onClose, onLike, onDelete, user}){
  const[confirmDelete,setConfirmDelete]=useState(false);
  const[fullscreen,setFullscreen]=useState(false);
  const isOwner = user && photo.user_id === user.id;

  // Lock scroll when open
  useEffect(()=>{
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return ()=>{ document.body.style.overflow = prev; };
  },[]);

  if(fullscreen&&photo.image_url){
    return(
      <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.97)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setFullscreen(false)}>
        <img src={photo.image_url} alt={photo.title} style={{maxWidth:"95vw",maxHeight:"95vh",objectFit:"contain"}}/>
        <button style={{position:"absolute",top:20,right:20,width:44,height:44,borderRadius:"50%",background:"rgba(255,255,255,0.1)",border:"none",color:"#fff",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
      </div>
    );
  }

  return(
    <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(42,36,32,0.5)"}}>
      {/* Sheet */}
      <div style={{
        position:"absolute",bottom:0,left:0,right:0,
        height:"92%",
        background:C.bg,
        borderRadius:"18px 18px 0 0",
        display:"flex",flexDirection:"column",
        animation:"mobileSheetUp 0.38s cubic-bezier(0.16,1,0.3,1)",
        overflow:"hidden",
      }}>
        {/* Drag handle */}
        <div style={{display:"flex",justifyContent:"center",padding:"12px 0 6px",flexShrink:0}}>
          <div style={{width:36,height:4,borderRadius:2,background:"rgba(42,36,32,0.18)"}}/>
        </div>

        <div style={{overflowY:"auto",flex:1,WebkitOverflowScrolling:"touch"}}>
          {/* Hero photo */}
          <div style={{width:"100%",height:220,position:"relative",flexShrink:0,background:photo.image_url?`url(${photo.image_url}) center/cover`:C.sidebar}}>
            {!photo.image_url&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1"><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="12" cy="12" r="4"/></svg></div>}
            <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(42,36,32,0.6) 0%,transparent 55%)"}}/>
            <button onClick={onClose} style={{position:"absolute",top:14,right:14,width:36,height:36,borderRadius:"50%",background:"rgba(42,36,32,0.45)",border:"none",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,backdropFilter:"blur(8px)"}}>×</button>
            {photo.image_url&&<button onClick={()=>setFullscreen(true)} style={{position:"absolute",top:14,right:58,width:36,height:36,borderRadius:"50%",background:"rgba(42,36,32,0.45)",border:"none",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg></button>}
            {photo.film_type&&<div style={{position:"absolute",top:14,left:14,background:"rgba(200,149,108,0.9)",padding:"4px 10px",fontSize:10,color:"#fff",fontWeight:600,letterSpacing:"0.08em",fontFamily:C.fontSans,backdropFilter:"blur(8px)"}}>{photo.film_type}</div>}
          </div>

          <div style={{padding:"20px 20px 40px"}}>
            <h2 style={{fontSize:26,fontWeight:300,color:C.dark,margin:"0 0 4px",fontFamily:C.font,lineHeight:1.2}}>{photo.title}</h2>
            <div style={{fontSize:13,color:C.muted,fontFamily:C.fontSans,marginBottom:12}}>{photo.city}, {photo.country} · {timeAgo(photo.created_at||photo.captured_at)}</div>
            {photo.description&&<p style={{fontSize:15,color:"#5A4A38",fontFamily:C.font,lineHeight:1.8,margin:"0 0 18px",fontStyle:"italic"}}>{photo.description}</p>}

            {/* Like */}
            <button onClick={()=>onLike(photo.id)}
              style={{width:"100%",padding:"12px",border:`1px solid ${photo.user_liked?"rgba(200,149,108,0.4)":C.border}`,background:photo.user_liked?"rgba(200,149,108,0.08)":"transparent",color:photo.user_liked?C.accent:C.muted,fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:16,fontFamily:C.fontSans,letterSpacing:"0.06em"}}>
              {photo.user_liked?"♥":"♡"} {photo.like_count||0} {photo.like_count===1?"like":"likes"}
            </button>

            {/* Delete */}
            {isOwner&&(confirmDelete?(
              <div style={{marginBottom:16,padding:"14px",background:"rgba(192,57,43,0.04)",border:"1px solid rgba(192,57,43,0.15)"}}>
                <div style={{fontSize:13,color:C.dark,fontFamily:C.font,marginBottom:12,lineHeight:1.5}}>Are you sure? This cannot be undone.</div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>onDelete(photo.id)} style={{flex:1,padding:"11px",background:C.error,color:"#fff",border:"none",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:C.fontSans,letterSpacing:"0.08em",textTransform:"uppercase"}}>Delete</button>
                  <button onClick={()=>setConfirmDelete(false)} style={{flex:1,padding:"11px",background:"transparent",color:C.muted,border:`1px solid ${C.border}`,fontSize:13,cursor:"pointer",fontFamily:C.fontSans}}>Cancel</button>
                </div>
              </div>
            ):(
              <button onClick={()=>setConfirmDelete(true)}
                style={{width:"100%",padding:"11px",border:"1px solid rgba(192,57,43,0.2)",background:"transparent",color:"rgba(192,57,43,0.7)",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:16,fontFamily:C.fontSans,letterSpacing:"0.08em",textTransform:"uppercase"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                Delete Photo
              </button>
            ))}

            {/* Photographer */}
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:C.sidebar,marginBottom:20,border:`1px solid ${C.border}`}}>
              <div style={{width:40,height:40,borderRadius:"50%",background:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:600,fontSize:15,color:"#fff",fontFamily:C.fontSans,flexShrink:0}}>{(photo.photographer_name||"?").charAt(0).toUpperCase()}</div>
              <div>
                <div style={{fontSize:16,fontWeight:400,color:C.dark,fontFamily:C.font}}>{photo.photographer_name||"Unknown"}</div>
                <div style={{fontSize:12,color:C.muted,fontFamily:C.fontSans}}>@{photo.photographer_username||"user"}</div>
              </div>
            </div>

            {/* Camera */}
            <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:600,marginBottom:8,fontFamily:C.fontSans}}>Camera & Lens</div>
            <div style={{padding:"12px 14px",background:C.sidebar,border:`1px solid ${C.border}`,marginBottom:16}}>
              <div style={{fontSize:17,fontWeight:400,color:C.accent,fontFamily:C.font,marginBottom:2}}>{photo.camera}</div>
              <div style={{fontSize:13,color:C.muted,fontFamily:C.fontSans}}>{photo.lens||"—"}</div>
              {photo.film_type&&<div style={{fontSize:12,color:C.muted,fontFamily:C.fontSans,marginTop:4}}>Film: {photo.film_type}</div>}
            </div>

            {/* Settings grid */}
            <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:600,marginBottom:8,fontFamily:C.fontSans}}>Settings</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:16}}>
              {[{l:"Aperture",v:photo.aperture},{l:"Shutter",v:photo.shutter_speed},{l:"ISO",v:photo.iso},{l:"Focal",v:photo.focal_length},{l:"Flash",v:photo.flash},{l:"WB",v:photo.white_balance}].map(b=>
                <div key={b.l} style={{background:C.sidebar,padding:"9px 12px",border:`1px solid ${C.border}`}}>
                  <span style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,fontFamily:C.fontSans}}>{b.l}</span>
                  <div style={{fontSize:14,color:C.dark,fontWeight:400,fontFamily:C.font,marginTop:2}}>{b.v||"—"}</div>
                </div>
              )}
            </div>

            {photo.tags?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>
              {photo.tags.map(t=><span key={t} style={{padding:"5px 12px",fontSize:12,fontWeight:500,background:"transparent",color:C.muted,border:`1px solid ${C.border}`,fontFamily:C.fontSans}}>#{t}</span>)}
            </div>}

            <div style={{fontSize:12,color:C.muted,borderTop:`1px solid ${C.border}`,paddingTop:12,fontFamily:C.fontSans}}>{photo.captured_at?"Captured "+fmtDate(photo.captured_at):"Uploaded "+fmtDate(photo.created_at)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mobile Globe Layout ──
function MobilePhotoGlobe({onNavigate, photos, filtered, stats, selectedId, setSelectedId, user, userLikes, search, setSearch, filter, setFilter, allTags, onLike, onDelete, onUploadClick, onAuthClick, loadPhotos}){
  const[panelOpen,setPanelOpen]=useState(false);
  const panelRef=useRef(null);
  const dragStartY=useRef(null);
  const dragStartScroll=useRef(null);

  const sel=filtered.find(p=>p.id===selectedId);

  // When a pin is tapped, open the photo detail sheet
  const handlePinSelect=(id)=>{
    setSelectedId(selectedId===id?null:id);
    if(id&&id!==selectedId){
      // Don't auto-open panel — show detail sheet directly
    }
  };

  // Touch drag to close panel
  const handleDragStart=(e)=>{
    dragStartY.current=e.touches[0].clientY;
    dragStartScroll.current=panelRef.current?.scrollTop||0;
  };
  const handleDragMove=(e)=>{
    if(dragStartY.current===null)return;
    const dy=e.touches[0].clientY-dragStartY.current;
    // Only close if panel is scrolled to top and dragging down
    if(dragStartScroll.current===0&&dy>60){
      setPanelOpen(false);
      dragStartY.current=null;
    }
  };
  const handleDragEnd=()=>{
    dragStartY.current=null;
  };

  // Globe peek height: 10% of screen = ~68px on typical phone
  const PEEK_HEIGHT=Math.round(window.innerHeight*0.10);
  const PANEL_HEIGHT=window.innerHeight-PEEK_HEIGHT;

  return(
    <div style={{width:"100vw",height:"100vh",overflow:"hidden",position:"relative",background:"#1C1C1E"}}>

      {/* ── Full-screen globe ── */}
      <div style={{position:"absolute",inset:0}}>
        <GlobeCanvas photos={filtered} selectedId={selectedId} onSelect={handlePinSelect}/>
      </div>

      {/* ── Legend — top left ── */}
      <div style={{
        position:"absolute",top:16,left:16,zIndex:30,
        background:"rgba(28,28,30,0.82)",
        border:"1px solid rgba(200,149,108,0.2)",
        backdropFilter:"blur(12px)",
        padding:"8px 12px",
        borderRadius:6,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:C.accent,boxShadow:`0 0 4px ${C.accent}`}}/>
          <span style={{fontSize:10,color:"rgba(245,240,235,0.55)",fontFamily:C.fontSans,letterSpacing:"0.06em"}}>Photo</span>
        </div>
        <div style={{fontSize:10,color:"rgba(245,240,235,0.3)",fontFamily:C.fontSans,letterSpacing:"0.03em"}}>Drag · Pinch to zoom</div>
      </div>

      {/* ── Back to site — top right ── */}
      <div style={{position:"absolute",top:16,right:16,zIndex:30}}>
        <button onClick={()=>onNavigate("home")}
          style={{padding:"8px 14px",background:"rgba(28,28,30,0.82)",border:"1px solid rgba(200,149,108,0.22)",color:"rgba(245,240,235,0.6)",fontSize:10,cursor:"pointer",fontFamily:C.fontSans,letterSpacing:"0.1em",textTransform:"uppercase",backdropFilter:"blur(12px)",borderRadius:4}}>
          ← Back
        </button>
      </div>

      {/* ── View Photos bar — bottom (when panel closed) ── */}
      {!panelOpen&&(
        <div style={{
          position:"absolute",bottom:16,left:16,right:16,zIndex:30,
          display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,
        }}>
          {/* Stats pill — matches legend style */}
          <div style={{
            background:"rgba(28,28,30,0.82)",
            border:"1px solid rgba(200,149,108,0.2)",
            backdropFilter:"blur(12px)",
            padding:"8px 12px",
            borderRadius:6,
          }}>
            <div style={{fontSize:9,color:"rgba(200,149,108,0.65)",letterSpacing:"0.2em",textTransform:"uppercase",fontFamily:C.fontSans,marginBottom:3}}>PHOTOGLOBE</div>
            <div style={{fontSize:13,color:"rgba(245,240,235,0.75)",fontFamily:C.font,fontWeight:300,letterSpacing:"0.02em"}}>
              {stats.p} {stats.p===1?"photo":"photos"} · {stats.c} {stats.c===1?"country":"countries"}
            </div>
          </div>
          {/* View Photos button — matches legend style */}
          <button
            onClick={()=>setPanelOpen(true)}
            style={{
              display:"flex",alignItems:"center",gap:6,
              background:"rgba(28,28,30,0.82)",
              border:"1px solid rgba(200,149,108,0.2)",
              backdropFilter:"blur(12px)",
              color:"rgba(245,240,235,0.75)",
              padding:"8px 14px",
              fontSize:11,fontWeight:600,
              cursor:"pointer",
              fontFamily:C.fontSans,
              letterSpacing:"0.1em",
              textTransform:"uppercase",
              borderRadius:6,
              flexShrink:0,
            }}>
            <div style={{width:7,height:7,borderRadius:"50%",background:C.accent,boxShadow:`0 0 4px ${C.accent}`,flexShrink:0}}/>
            View Photos ↑
          </button>
        </div>
      )}

      {/* ── Bottom Sheet Panel ── */}
      {panelOpen&&(
        <>
          {/* Tap on globe peek to close */}
          <div
            style={{position:"absolute",top:0,left:0,right:0,height:PEEK_HEIGHT,zIndex:39,cursor:"pointer"}}
            onClick={()=>setPanelOpen(false)}
          />

          <div
            style={{
              position:"absolute",
              bottom:0,left:0,right:0,
              height:PANEL_HEIGHT,
              zIndex:40,
              background:C.sidebar,
              borderRadius:"18px 18px 0 0",
              display:"flex",flexDirection:"column",
              animation:"mobileSheetUp 0.38s cubic-bezier(0.16,1,0.3,1)",
              overflow:"hidden",
              boxShadow:"0 -8px 40px rgba(42,36,32,0.18)",
            }}
          >
            {/* Drag handle */}
            <div
              style={{display:"flex",justifyContent:"center",padding:"12px 0 6px",flexShrink:0,cursor:"grab"}}
              onTouchStart={handleDragStart}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
            >
              <div style={{width:36,height:4,borderRadius:2,background:"rgba(42,36,32,0.2)"}}/>
            </div>

            {/* Panel header */}
            <div style={{padding:"0 20px 12px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
                <div>
                  <div style={{fontSize:9,letterSpacing:"0.2em",textTransform:"uppercase",color:C.accent,fontFamily:C.font,marginBottom:2}}>PhotoGlobe</div>
                  <div style={{fontSize:24,fontWeight:300,color:C.dark,fontFamily:C.font,lineHeight:1}}>SAEIRIS</div>
                  <div style={{fontSize:11,color:C.muted,fontFamily:C.fontSans,marginTop:3,letterSpacing:"0.04em"}}>Film & Digital Photos</div>
                </div>
                {user?(
                  <button onClick={()=>supabase.auth.signOut()} style={{padding:"7px 13px",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontSize:11,cursor:"pointer",fontFamily:C.fontSans,letterSpacing:"0.06em",marginTop:4}}>Sign Out</button>
                ):(
                  <button onClick={onAuthClick} style={{padding:"7px 13px",background:"transparent",border:`1px solid ${C.accent}`,color:C.accent,fontSize:11,cursor:"pointer",fontFamily:C.fontSans,letterSpacing:"0.06em",fontWeight:600,marginTop:4}}>Sign In</button>
                )}
              </div>

              {/* Stats */}
              <div style={{display:"flex",gap:0,marginBottom:14,border:`1px solid ${C.border}`}}>
                {[{l:"Photos",v:stats.p},{l:"Countries",v:stats.c},{l:"Cameras",v:stats.cam}].map((s,i)=>(
                  <div key={s.l} style={{flex:1,padding:"10px 6px",textAlign:"center",borderRight:i<2?`1px solid ${C.border}`:"none"}}>
                    <div style={{fontSize:20,fontWeight:300,color:C.dark,fontFamily:C.font}}>{s.v}</div>
                    <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:C.fontSans,marginTop:2}}>{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Search */}
              <div style={{position:"relative",marginBottom:10}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <input
                  type="text"
                  value={search}
                  onChange={e=>setSearch(e.target.value)}
                  placeholder="Search photos..."
                  style={{width:"100%",padding:"10px 14px 10px 34px",background:C.bg,border:`1px solid ${C.border}`,color:C.dark,fontSize:14,outline:"none",fontFamily:C.font,boxSizing:"border-box"}}
                />
              </div>

              {/* Tag filters */}
              <div style={{display:"flex",flexWrap:"nowrap",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:2}}>
                <button onClick={()=>setFilter("all")} style={{padding:"4px 12px",fontSize:11,background:filter==="all"?"rgba(200,149,108,0.1)":"transparent",color:filter==="all"?C.accent:C.muted,border:`1px solid ${filter==="all"?C.accent:C.border}`,cursor:"pointer",fontFamily:C.fontSans,flexShrink:0,borderRadius:2}}>All</button>
                {allTags.slice(0,8).map(t=><button key={t} onClick={()=>setFilter(filter===t?"all":t)} style={{padding:"4px 12px",fontSize:11,background:filter===t?"rgba(200,149,108,0.1)":"transparent",color:filter===t?C.accent:C.muted,border:`1px solid ${filter===t?C.accent:C.border}`,cursor:"pointer",fontFamily:C.fontSans,flexShrink:0,borderRadius:2}}>#{t}</button>)}
              </div>
            </div>

            {/* Photo list */}
            <div
              ref={panelRef}
              style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch"}}
              onTouchStart={handleDragStart}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
            >
              {filtered.length===0?(
                <div style={{textAlign:"center",padding:"48px 20px",color:C.muted}}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1" style={{marginBottom:12,opacity:0.5}}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                  <div style={{fontSize:16,fontWeight:300,color:C.dark,fontFamily:C.font,marginBottom:4}}>No photos yet</div>
                  <div style={{fontSize:13,fontFamily:C.fontSans}}>Be the first to upload.</div>
                </div>
              ):filtered.map(p=>(
                <PhotoListItem
                  key={p.id}
                  photo={p}
                  selected={selectedId===p.id}
                  onClick={()=>setSelectedId(selectedId===p.id?null:p.id)}
                />
              ))}
            </div>

            {/* Upload button */}
            <div style={{padding:"14px 16px",flexShrink:0,borderTop:`1px solid ${C.border}`}}>
              <button
                onClick={()=>{ if(!user){onAuthClick();}else{onUploadClick();} }}
                style={{width:"100%",padding:"14px",background:C.dark,color:C.bg,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:C.fontSans}}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                Upload Photo
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Mobile Photo Detail Sheet (renders on top of everything) ── */}
      {sel&&(
        <MobilePhotoDetail
          photo={sel}
          onClose={()=>setSelectedId(null)}
          onLike={onLike}
          onDelete={onDelete}
          user={user}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN PHOTOGLOBE (entry point)
// ══════════════════════════════════════════════════════════════
export default function PhotoGlobe({onNavigate}){
  const isMobile = window.innerWidth < 768;
  const globeOuterRef = useRef(null);
  const[cropMode,setCropMode]=useState(false);
  const[cropResolve,setCropResolve]=useState(null);

  const[photos,setPhotos]=useState([]);
  const[selectedId,setSelectedId]=useState(null);
  const[user,setUser]=useState(null);
  const[userLikes,setUserLikes]=useState(new Set());
  const[showUpload,setShowUpload]=useState(false);
  const[showAuth,setShowAuth]=useState(false);
  const[search,setSearch]=useState("");
  const[filter,setFilter]=useState("all");
  const[sidebar,setSidebar]=useState(true);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>setUser(session?.user||null));
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{setUser(session?.user||null);});
    return()=>subscription.unsubscribe();
  },[]);

  // iOS 26 Safari tints its status-bar / URL-bar from the document background-color. While
  // the globe view is mounted, paint html + body the globe's dark so those strips match and
  // the page reads full-screen. Restored on unmount (the site's cream tint takes back over).
  useEffect(()=>{
    const GLOBE_BG="#1C1C1E";
    const html=document.documentElement,body=document.body;
    const prev={html:html.style.backgroundColor,body:body.style.backgroundColor};
    html.style.backgroundColor=GLOBE_BG;
    body.style.backgroundColor=GLOBE_BG;
    return()=>{
      html.style.backgroundColor=prev.html;
      body.style.backgroundColor=prev.body;
    };
  },[]);

  const loadPhotos=useCallback(async()=>{
    const{data,error}=await supabase.from('photos_with_likes').select('*').order('created_at',{ascending:false});
    if(!error&&data)setPhotos(data);
  },[]);
  useEffect(()=>{loadPhotos();},[loadPhotos]);

  useEffect(()=>{
    if(!user)return;
    supabase.from('likes').select('photo_id').eq('user_id',user.id).then(({data})=>{if(data)setUserLikes(new Set(data.map(l=>l.photo_id)));});
  },[user,photos]);

  const photosWithLikes=useMemo(()=>photos.map(p=>({...p,user_liked:userLikes.has(p.id)})),[photos,userLikes]);

  const handleLike=async(photoId)=>{
    if(!user){setShowAuth(true);return;}
    const liked=userLikes.has(photoId);
    if(liked){await supabase.from('likes').delete().eq('user_id',user.id).eq('photo_id',photoId);setUserLikes(prev=>{const n=new Set(prev);n.delete(photoId);return n;});}
    else{await supabase.from('likes').insert({user_id:user.id,photo_id:photoId});setUserLikes(prev=>new Set(prev).add(photoId));}
    loadPhotos();
  };

  const handleDelete=async(photoId)=>{
    const photo=photos.find(p=>p.id===photoId);
    if(!photo||photo.user_id!==user?.id)return;
    if(photo.image_url){
      const path=photo.image_url.split('/photos/')[1];
      if(path)await supabase.storage.from('photos').remove([path]);
    }
    await supabase.from('photos').delete().eq('id',photoId);
    setSelectedId(null);
    loadPhotos();
  };

  const filtered=useMemo(()=>{
    let r=photosWithLikes;
    if(filter!=="all")r=r.filter(p=>p.tags?.includes(filter));
    if(search){const q=search.toLowerCase();r=r.filter(p=>p.title?.toLowerCase().includes(q)||p.city?.toLowerCase().includes(q)||p.country?.toLowerCase().includes(q)||p.camera?.toLowerCase().includes(q));}
    return r;
  },[photosWithLikes,filter,search]);

  const allTags=useMemo(()=>[...new Set(photos.flatMap(p=>p.tags||[]))].sort(),[photos]);
  const stats=useMemo(()=>({p:photos.length,c:new Set(photos.map(p=>p.country)).size,cam:new Set(photos.map(p=>p.camera)).size}),[photos]);
  const sel=photosWithLikes.find(p=>p.id===selectedId);

  // ── MOBILE LAYOUT ──
  if(isMobile){
    return(
      <>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes mobileSheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}::-webkit-scrollbar{display:none}input::placeholder{color:#8A7A68;font-family:'Cormorant Garamond',serif}input:focus{border-color:rgba(200,149,108,0.4)!important}`}</style>
        <MobilePhotoGlobe
          onNavigate={onNavigate}
          photos={photosWithLikes}
          filtered={filtered}
          stats={stats}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          user={user}
          userLikes={userLikes}
          search={search}
          setSearch={setSearch}
          filter={filter}
          setFilter={setFilter}
          allTags={allTags}
          onLike={handleLike}
          onDelete={handleDelete}
          onUploadClick={()=>setShowUpload(true)}
          onAuthClick={()=>setShowAuth(true)}
          loadPhotos={loadPhotos}
        />
        {showUpload&&user&&<UploadModal onClose={()=>setShowUpload(false)} onUpload={loadPhotos} user={user}/>}
        {showAuth&&<AuthModal onClose={()=>setShowAuth(false)} onAuth={()=>{loadPhotos();}}/>}
      </>
    );
  }

  // ── DESKTOP LAYOUT (unchanged) ──
  return(
    <div style={{width:"100vw",height:"100vh",background:C.bg,fontFamily:C.fontSans,display:"flex",overflow:"hidden",position:"relative",color:C.dark}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');*{box-sizing:border-box;margin:0;padding:0}@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(200,149,108,0.2);border-radius:2px}input::placeholder{color:#8A7A68;font-family:'Cormorant Garamond',serif}input:focus{border-color:rgba(200,149,108,0.4)!important}`}</style>

      {/* Sidebar */}
      <div style={{width:sidebar?320:0,flexShrink:0,background:C.sidebar,borderRight:sidebar?`1px solid ${C.border}`:"none",display:"flex",flexDirection:"column",transition:"width 0.3s",overflow:"hidden",zIndex:50}}>
        <div style={{padding:"24px 20px 16px",flexShrink:0,borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
            <div>
              <div style={{fontSize:10,letterSpacing:"0.2em",textTransform:"uppercase",color:C.accent,fontFamily:C.font,marginBottom:4}}>PhotoGlobe</div>
              <div style={{fontSize:26,fontWeight:300,color:C.dark,fontFamily:C.font,lineHeight:1}}>SAEIRIS</div>
              <div style={{fontSize:11,color:C.muted,fontFamily:C.fontSans,marginTop:4,letterSpacing:"0.06em"}}>Film & Digital Photos</div>
            </div>
            {user?
              <button onClick={()=>supabase.auth.signOut()} style={{padding:"6px 12px",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontSize:11,cursor:"pointer",fontFamily:C.fontSans,letterSpacing:"0.06em"}}>Sign Out</button>:
              <button onClick={()=>setShowAuth(true)} style={{padding:"6px 12px",background:"transparent",border:`1px solid ${C.accent}`,color:C.accent,fontSize:11,cursor:"pointer",fontFamily:C.fontSans,letterSpacing:"0.06em",fontWeight:600}}>Sign In</button>
            }
          </div>
          <div style={{display:"flex",gap:0,marginBottom:18,border:`1px solid ${C.border}`}}>
            {[{l:"Photos",v:stats.p},{l:"Countries",v:stats.c},{l:"Cameras",v:stats.cam}].map((s,i)=>(
              <div key={s.l} style={{flex:1,padding:"10px 8px",textAlign:"center",borderRight:i<2?`1px solid ${C.border}`:"none"}}>
                <div style={{fontSize:20,fontWeight:300,color:C.dark,fontFamily:C.font}}>{s.v}</div>
                <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:C.fontSans,marginTop:2}}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{position:"relative",marginBottom:12}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search photos..." style={{width:"100%",padding:"9px 14px 9px 34px",background:C.bg,border:`1px solid ${C.border}`,color:C.dark,fontSize:13,outline:"none",fontFamily:C.font}}/>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            <button onClick={()=>setFilter("all")} style={{padding:"3px 10px",fontSize:11,background:filter==="all"?"rgba(200,149,108,0.1)":"transparent",color:filter==="all"?C.accent:C.muted,border:`1px solid ${filter==="all"?C.accent:C.border}`,cursor:"pointer",fontFamily:C.fontSans}}>All</button>
            {allTags.slice(0,8).map(t=><button key={t} onClick={()=>setFilter(filter===t?"all":t)} style={{padding:"3px 10px",fontSize:11,background:filter===t?"rgba(200,149,108,0.1)":"transparent",color:filter===t?C.accent:C.muted,border:`1px solid ${filter===t?C.accent:C.border}`,cursor:"pointer",fontFamily:C.fontSans}}>#{t}</button>)}
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto"}}>
          {filtered.length===0&&photos.length===0?(
            <div style={{textAlign:"center",padding:"48px 20px",color:C.muted}}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1" style={{marginBottom:12,opacity:0.5}}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
              <div style={{fontSize:15,fontWeight:300,color:C.dark,fontFamily:C.font,marginBottom:4}}>No photos yet</div>
              <div style={{fontSize:12,fontFamily:C.fontSans}}>Be the first to upload.</div>
            </div>
          ):filtered.map(p=><PhotoListItem key={p.id} photo={p} selected={selectedId===p.id} onClick={()=>setSelectedId(selectedId===p.id?null:p.id)}/>)}
        </div>
        <div style={{padding:"16px 20px",flexShrink:0,borderTop:`1px solid ${C.border}`}}>
          <button onClick={()=>{if(!user){setShowAuth(true);}else{setShowUpload(true);}}}
            style={{width:"100%",padding:"13px",background:C.dark,color:C.bg,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:C.fontSans,transition:"background 0.3s"}}
            onMouseOver={e=>e.currentTarget.style.background=C.accent}
            onMouseOut={e=>e.currentTarget.style.background=C.dark}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            Upload Photo
          </button>
        </div>
      </div>

      {/* Globe area */}
      <div style={{flex:1,position:"relative",overflow:"hidden",background:"#1C1C1E"}}>
        <GlobeNav onNavigate={onNavigate}/>
        <button onClick={()=>setSidebar(!sidebar)}
          style={{position:"absolute",top:60,left:16,zIndex:40,width:36,height:36,background:"rgba(28,28,30,0.8)",border:`1px solid rgba(200,149,108,0.2)`,color:"rgba(245,240,235,0.5)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(10px)",transition:"all 0.2s"}}
          onMouseOver={e=>e.currentTarget.style.color="#F5F0EB"}
          onMouseOut={e=>e.currentTarget.style.color="rgba(245,240,235,0.5)"}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{sidebar?<path d="M15 18l-6-6 6-6"/>:<path d="M9 18l6-6-6-6"/>}</svg>
        </button>
        <div style={{position:"absolute",bottom:20,left:16,zIndex:40,display:"flex",gap:12,padding:"8px 14px",background:"rgba(28,28,30,0.8)",border:`1px solid rgba(200,149,108,0.15)`,backdropFilter:"blur(10px)",fontSize:11,color:"rgba(245,240,235,0.4)",fontFamily:C.fontSans,letterSpacing:"0.06em"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:6,height:6,borderRadius:"50%",background:C.accent}}/>Photo</div>
          <div style={{color:"rgba(200,149,108,0.2)"}}>·</div>
          <div>Drag · Scroll to zoom</div>
        </div>
        <GlobeCanvas photos={filtered} selectedId={selectedId} onSelect={id=>setSelectedId(selectedId===id?null:id)} outerRef={globeOuterRef}/>
        {cropMode&&<CropOverlay
          globeOuterRef={globeOuterRef}
          onCapture={(dataUrl)=>{
            setCropMode(false);
            if(cropResolve){cropResolve(dataUrl);setCropResolve(null);}
          }}
          onCancel={()=>{
            setCropMode(false);
            if(cropResolve){cropResolve(null);setCropResolve(null);}
          }}
        />}
        {sel&&<PhotoDetail photo={sel} onClose={()=>setSelectedId(null)} onLike={handleLike} onDelete={handleDelete} user={user} getGlobeSnapshot={()=>{
          return new Promise((resolve)=>{
            setCropResolve(()=>resolve);
            setCropMode(true);
          });
        }}/>}
      </div>

      {showUpload&&user&&<UploadModal onClose={()=>setShowUpload(false)} onUpload={loadPhotos} user={user}/>}
      {showAuth&&<AuthModal onClose={()=>setShowAuth(false)} onAuth={()=>{loadPhotos();}}/>}
    </div>
  );
}
