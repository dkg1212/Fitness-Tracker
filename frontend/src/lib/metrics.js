export const volumeForSet = s => (Number(s.weight)||0) * (Number(s.reps)||0);
export const volumeForWorkout = w => (w.exercises||[]).reduce((sum,e)=>sum+(e.sets||[]).filter(s=>s.completed && s.type!=='warmup').reduce((n,s)=>n+volumeForSet(s),0),0);
export const e1rm = (weight,reps) => reps > 0 && reps <= 12 ? Math.round(weight*(1+reps/30)*10)/10 : null;
export function muscleVolumes(workouts) {
  const out = {};
  workouts.forEach(w => (w.exercises||[]).forEach(e => (e.sets||[]).filter(s=>s.completed&&s.type!=='warmup').forEach(s => {
    const muscle=e.muscle||'Other'; out[muscle]=(out[muscle]||0)+volumeForSet(s);
  })));
  return out;
}
export function personalRecords(workouts) {
  const out={};
  workouts.forEach(w => (w.exercises||[]).forEach(e => (e.sets||[]).filter(s=>s.completed&&s.type!=='warmup').forEach(s=>{
    const estimate=e1rm(Number(s.weight)||0,Number(s.reps)||0);
    if(estimate && (!out[e.name]||estimate>out[e.name].e1rm)) out[e.name]={name:e.name,e1rm:estimate,weight:s.weight,reps:s.reps,date:w.date};
  })));
  return Object.values(out).sort((a,b)=>b.e1rm-a.e1rm);
}
