export const CAR_COLORS=[
  {id:'silver',name:'Kumush',hex:'#737b84'},
  {id:'red',name:'Qizil',hex:'#d92f40'},
  {id:'blue',name:'Moviy',hex:'#287ee8'},
  {id:'green',name:'Yashil',hex:'#20ad79'},
  {id:'yellow',name:'Sariq',hex:'#f3c831'},
  {id:'orange',name:'To‘q sariq',hex:'#fb6947'},
];
export function mountCarColors(container,onChange){
  let selected=['silver','orange'];
  try{
    const saved=JSON.parse(localStorage.getItem('apex-car-colors'));
    selected=selected.map((fallback,i)=>CAR_COLORS.some(c=>c.id===saved?.[i])?saved[i]:fallback);
  }catch{}
  const panel=document.createElement('section');panel.id='car-colors';panel.lang='uz';
  panel.innerHTML='<h3>Mashina rangi</h3><p>Tanlov avtomatik saqlanadi. P2 — ikki kishilik poyga uchun.</p>';
  const refresh=()=>{
    for(const button of panel.querySelectorAll('button'))button.setAttribute('aria-pressed',String(selected[Number(button.dataset.player)]===button.dataset.color));
  };
  selected.forEach((_,i)=>{
    const row=document.createElement('fieldset');
    row.innerHTML=`<legend>PLAYER ${i+1}</legend>`;
    for(const color of CAR_COLORS){
      const button=document.createElement('button');button.type='button';button.dataset.player=i;button.dataset.color=color.id;
      button.setAttribute('aria-label',`Player ${i+1}: ${color.name}`);button.title=color.name;
      button.innerHTML='<i aria-hidden="true"></i><span></span>';
      button.querySelector('i').style.backgroundColor=color.hex;button.querySelector('span').textContent=color.name;
      button.onclick=()=>{
        selected[i]=color.id;refresh();onChange();
        try{localStorage.setItem('apex-car-colors',JSON.stringify(selected));}catch{}
      };
      row.append(button);
    }
    panel.append(row);
  });
  container.before(panel);refresh();
  return {
    apply(world){
      if(!world)return;
      [world.car,world.splitViews?.[1].car].forEach((model,i)=>{
        const color=CAR_COLORS.find(c=>c.id===selected[i]).hex;
        model?.traverse(o=>{if(o.isMesh&&o.material.name==='body-paint')o.material.color.set(color);});
      });
    },
  };
}

export function mountRecordCelebration(container){
  const banner=document.createElement('div');banner.id='record-celebration';banner.hidden=true;banner.lang='uz';
  banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');
  const title=document.createElement('strong');title.textContent='Yangi rekord!';
  const detail=document.createElement('span');banner.append(title,detail);
  for(let i=0;i<16;i++){
    const spark=document.createElement('i');spark.setAttribute('aria-hidden','true');
    spark.style.setProperty('--angle',`${i*22.5}deg`);spark.style.setProperty('--delay',`${i%4*.06}s`);banner.append(spark);
  }
  container.prepend(banner);
  let timer;
  const hide=()=>{clearTimeout(timer);banner.hidden=true;};
  return {hide,show(records){
    hide();if(!records.length)return;
    detail.textContent=records.join(' · ');
    // Flush the hidden state so a second record restarts the CSS celebration.
    void banner.offsetWidth;
    banner.hidden=false;
    timer=setTimeout(hide,3400);
  }};
}
