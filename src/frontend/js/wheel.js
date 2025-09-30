// Responsável pela criação e animação da roleta
export class Wheel {
  constructor(store){
    this.store = store;
    this.wheelSpinning = false;
    this.currentRotation = 0; // normalizado 0..359
    this.visualRotation = 0; // acumulado
    this.duration = 5000;
    // textMode:
  //  - 'radial': texto alinhado ao raio (com flip para não ficar de cabeça para baixo)
  //  - 'radial-uniform': texto alinhado ao raio SEM flip (todas apontam mesma direção)
    //  - 'upright': texto horizontal (sem rotação)
    //  - 'curved': texto acompanhando arco
  this.textMode = 'radial-uniform';
  }
  getOrderedNames(){
    const { items } = this.store;
    const real = Object.keys(items).filter(n=>!n.startsWith('Nenhum item'));
    const none = Object.keys(items).filter(n=>n.startsWith('Nenhum item'));
    const ordered=[]; let iR=0,iN=0; while(iR<real.length || iN<none.length){ if(iR<real.length) ordered.push(real[iR++]); if(iN<none.length) ordered.push(none[iN++]); }
    return ordered;
  }
  render(){
    const cont=document.getElementById('wheel-segments'); if(!cont) return; cont.innerHTML='';
    const names=this.getOrderedNames(); if(!names.length) return;
    const angle=360/names.length; const r=240,cx=250,cy=250; const colors=['#E74C3C','#3498DB','#2ECC71','#F39C12','#9B59B6','#1ABC9C','#E67E22','#34495E','#95A5A6','#D35400'];

    // Caso especial: apenas 1 item real e nenhum placeholder => roda inteira com a cor do item
    const realOnly = names.length===1 && !names[0].startsWith('Nenhum item');
    if(realOnly){
      const path=document.createElementNS('http://www.w3.org/2000/svg','circle');
      path.setAttribute('cx',cx); path.setAttribute('cy',cy); path.setAttribute('r',r);
      path.setAttribute('fill', colors[0]);
      path.setAttribute('stroke','#fff'); path.setAttribute('stroke-width','4');
      cont.appendChild(path);
      const text=document.createElementNS('http://www.w3.org/2000/svg','text');
      text.setAttribute('x', cx); text.setAttribute('y', cy); text.setAttribute('class','wheel-text');
      text.textContent = names[0];
      cont.appendChild(text);
      return; // nada mais a fazer
    }
  names.forEach((n,i)=>{
      const start=(i*angle-90)*Math.PI/180,
            end=((i+1)*angle-90)*Math.PI/180,
            mid=(start+end)/2;
      const x1=cx+r*Math.cos(start), y1=cy+r*Math.sin(start), x2=cx+r*Math.cos(end), y2=cy+r*Math.sin(end);
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d',`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${angle>180?1:0} 1 ${x2} ${y2} Z`);
      path.setAttribute('fill', n.startsWith('Nenhum item')? '#555': colors[i%colors.length]);
      path.setAttribute('stroke','#fff');
      path.setAttribute('stroke-width','2');
      path.dataset.segIndex=i;
      cont.appendChild(path);

      if(this.textMode==='curved'){
        // Texto curvo usando textPath
        const textRadius = r * 0.78;
        const startDeg = (i*angle - 90);
        const endDeg = ((i+1)*angle - 90);
        const midDeg = startDeg + angle/2;
        const polar = (deg, rad)=>{ const radian = deg*Math.PI/180; return { x: cx + rad*Math.cos(radian), y: cy + rad*Math.sin(radian) }; };
        let pStart = polar(startDeg, textRadius);
        let pEnd = polar(endDeg, textRadius);
        let largeArc = angle>180 ? 1 : 0;
        if(midDeg > 90 && midDeg < 270){ [pStart, pEnd] = [pEnd, pStart]; }
        const arcId = `segArc-${i}-${Date.now()}`;
        const arcPath = document.createElementNS('http://www.w3.org/2000/svg','path');
        arcPath.setAttribute('id', arcId);
        arcPath.setAttribute('d', `M ${pStart.x} ${pStart.y} A ${textRadius} ${textRadius} 0 ${largeArc} 1 ${pEnd.x} ${pEnd.y}`);
        arcPath.setAttribute('fill','none'); arcPath.setAttribute('stroke','none');
        cont.appendChild(arcPath);
        const text = document.createElementNS('http://www.w3.org/2000/svg','text');
        text.setAttribute('class','wheel-text');
        const textPath = document.createElementNS('http://www.w3.org/2000/svg','textPath');
        textPath.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href',`#${arcId}`);
        textPath.setAttribute('startOffset','50%'); textPath.setAttribute('text-anchor','middle');
        const label = n.startsWith('Nenhum item')? 'Não foi dessa vez': n;
        textPath.textContent = label.length>18 ? label.slice(0,18)+'…' : label;
        text.appendChild(textPath); cont.appendChild(text);
      } else if(this.textMode==='upright') {
        // Texto horizontal (sem rotação)
        const textRadius = r * 0.70;
        const tx = cx + textRadius*Math.cos(mid);
        const ty = cy + textRadius*Math.sin(mid);
        const text = document.createElementNS('http://www.w3.org/2000/svg','text');
        text.setAttribute('x', tx); text.setAttribute('y', ty);
        text.setAttribute('class','wheel-text');
        text.setAttribute('text-anchor','middle');
        text.setAttribute('dominant-baseline','middle');
        let fs = 14; if(names.length>14) fs=13; if(names.length>18) fs=12; if(names.length>24) fs=11; if(names.length>32) fs=10;
        text.setAttribute('font-size', fs);
        const label = n.startsWith('Nenhum item')? 'Não foi dessa vez': n;
        text.textContent = label.length>18 ? label.slice(0,18)+'…' : label;
        cont.appendChild(text);
      } else if(this.textMode==='radial') {
        // Texto alinhado ao raio (direção das linhas verdes)
        const baseRadius = r * 0.68; // posição padrão
        let angleDeg = mid * 180/Math.PI; // ângulo do raio
        angleDeg = (angleDeg + 360) % 360; // normaliza
        let invert = false;
        // Se o texto ficaria de cabeça para baixo (lado esquerdo), gira 180° e aproxima um pouco
        if(angleDeg > 90 && angleDeg < 270){
          angleDeg = (angleDeg + 180) % 360;
          invert = true;
        }
        const useRadius = invert ? r * 0.60 : baseRadius;
        const tx = cx + useRadius*Math.cos(mid);
        const ty = cy + useRadius*Math.sin(mid);
        const text = document.createElementNS('http://www.w3.org/2000/svg','text');
        text.setAttribute('x', tx); text.setAttribute('y', ty);
        text.setAttribute('class','wheel-text');
        text.setAttribute('text-anchor','middle');
        text.setAttribute('dominant-baseline','middle');
        let fs = 14; if(names.length>14) fs=13; if(names.length>18) fs=12; if(names.length>24) fs=11; if(names.length>32) fs=10;
        text.setAttribute('font-size', fs);
        const label = n.startsWith('Nenhum item')? 'Não foi dessa vez': n;
        text.textContent = label.length>18 ? label.slice(0,18)+'…' : label;
        text.setAttribute('transform', `rotate(${angleDeg} ${tx} ${ty})`);
        cont.appendChild(text);
      } else if(this.textMode==='radial-uniform') {
        // Texto radial sem flip: todo mundo aponta para fora (pode ficar invertido do lado esquerdo visualmente)
        const baseRadius = r * 0.68;
        let angleDeg = mid * 180/Math.PI;
        angleDeg = (angleDeg + 360) % 360;
        const tx = cx + baseRadius*Math.cos(mid);
        const ty = cy + baseRadius*Math.sin(mid);
        const text = document.createElementNS('http://www.w3.org/2000/svg','text');
        text.setAttribute('x', tx); text.setAttribute('y', ty);
        text.setAttribute('class','wheel-text');
        text.setAttribute('text-anchor','middle');
        text.setAttribute('dominant-baseline','middle');
        let fs = 14; if(names.length>14) fs=13; if(names.length>18) fs=12; if(names.length>24) fs=11; if(names.length>32) fs=10;
        text.setAttribute('font-size', fs);
        const label = n.startsWith('Nenhum item')? 'Não foi dessa vez': n;
        text.textContent = label.length>18 ? label.slice(0,18)+'…' : label;
        text.setAttribute('transform', `rotate(${angleDeg} ${tx} ${ty})`);
        cont.appendChild(text);
      }
    });
  }
  spin(onResult){
    if(this.wheelSpinning) return; this.wheelSpinning=true; const ordered=this.getOrderedNames(); if(!ordered.length){ this.wheelSpinning=false; return; }
    // Distribuição baseada no percentual global itemChancePercent
    const { wItem, wNone } = this.store.derivedWeights();
    const realNames = ordered.filter(n=>!n.startsWith('Nenhum item'));
    const activeReal = realNames.filter(n=> (this.store.items[n]||0) > 0); // apenas itens com quantidade >0 podem ser sorteados
    const totalNone = ordered.filter(n=>n.startsWith('Nenhum item')).length;
    const effWItem = activeReal.length>0? wItem : 0;
    const effWNone = totalNone>0? wNone : 0;
    const perItem = activeReal.length>0? effWItem / activeReal.length : 0;
    const perNone = totalNone>0? effWNone / totalNone : 0;
    const weights = ordered.map(n=> {
      if(n.startsWith('Nenhum item')) return perNone; // placeholders sempre sorteáveis
      const qty = this.store.items[n]||0;
      if(qty<=0) return 0; // item aparece mas não pode ser escolhido
      return perItem;
    });
    // Se não houver nenhum peso positivo, aborta (não há resultado válido)
    if(!weights.some(w=>w>0)) { this.wheelSpinning=false; return; }
    const totalW = weights.reduce((a,b)=>a+b,0); let rnd=Math.random()*totalW; let chosenIndex=0; for(let i=0;i<weights.length;i++){ rnd-=weights[i]; if(rnd<=0){ chosenIndex=i; break; } }
    const angle=360/ordered.length; const halfAngle=angle/2; const marginDeg=Math.min(8, halfAngle*0.55); let interiorOffset=0; const maxOffset=halfAngle-marginDeg; if(maxOffset>0) interiorOffset=(Math.random()*2-1)*maxOffset; const chosenInterior=chosenIndex*angle+halfAngle+interiorOffset; const extra=7+Math.floor(Math.random()*3); const targetBase=(360-(chosenInterior%360)+360)%360; const baseDelta=(targetBase-this.currentRotation+360)%360; const delta=baseDelta+extra*360; this.visualRotation+=delta; const wheelEl=document.getElementById('wheel'); wheelEl.style.transition=`transform ${this.duration/1000}s cubic-bezier(0.15,0.8,0.25,1)`; void wheelEl.offsetWidth; wheelEl.style.transform=`rotate(${this.visualRotation}deg)`; this.currentRotation=targetBase; setTimeout(()=>{ wheelEl.style.transition=''; const normRot=this.currentRotation; const rawChosenInterior=(360-normRot)%360; let landedIndex=Math.floor(rawChosenInterior/angle); if(landedIndex<0) landedIndex=0; if(landedIndex>=ordered.length) landedIndex=ordered.length-1; onResult(ordered[landedIndex], landedIndex); this.wheelSpinning=false; }, this.duration);
  }
}
