const colors={
  ink:'#262920',page:'#f9f7f2',surface:'#fffdfa',white:'#ffffff',pink:'#f957a4',
  lime:'#dfff78',lilac:'#6652c5',success:'#2f6b2f',warning:'#9a4d00',
  danger:'#b42318',info:'#275dab',secondary:'#52554d',border:'#6f726a',
  disabled:'#e5e3df',
};

const channel=(value)=>{
  const n=value/255;
  return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;
};
const luminance=(hex)=>{
  const value=hex.slice(1);
  const [r,g,b]=[0,2,4].map((index)=>channel(Number.parseInt(value.slice(index,index+2),16)));
  return .2126*r+.7152*g+.0722*b;
};
const ratio=(foreground,background)=>{
  const values=[luminance(colors[foreground]),luminance(colors[background])].sort((a,b)=>b-a);
  return (values[0]+.05)/(values[1]+.05);
};

const checks=[
  ['white','ink',4.5,'Texto blanco / Ink'],
  ['ink','pink',4.5,'Texto Ink / Pink'],
  ['white','lilac',4.5,'Texto blanco / Lilac'],
  ['ink','lime',4.5,'Texto Ink / Lime'],
  ['white','success',4.5,'Texto blanco / Success'],
  ['white','warning',4.5,'Texto blanco / Warning'],
  ['white','danger',4.5,'Texto blanco / Danger'],
  ['white','info',4.5,'Texto blanco / Info'],
  ['secondary','page',4.5,'Texto secundario / Page'],
  ['secondary','disabled',4.5,'Texto / Disabled'],
  ['lilac','page',3,'Focus ring / Page'],
  ['border','surface',3,'Borde de input / Surface'],
];

let failed=false;
for(const [foreground,background,minimum,label] of checks){
  const result=ratio(foreground,background);
  const passes=result>=minimum;
  failed||=!passes;
  console.log(`${passes?'PASS':'FAIL'} ${result.toFixed(2)}:1 ≥ ${minimum}:1 — ${label}`);
}
if(failed) process.exitCode=1;
