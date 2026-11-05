const KEY='ironcore-workout-tracker-v1';
export const defaultExercises=[
 ['Barbell Bench Press','Chest','Barbell'],['Incline Smith Machine Press','Chest','Smith Machine'],['Flat Smith Machine Press','Chest','Smith Machine'],['Cable Fly','Chest','Cable'],['Push-Up','Chest','Bodyweight'],
 ['Lat Pulldown','Back','Cable'],['Pull-Up','Back','Bodyweight'],['Seated Cable Row','Back','Cable'],['Barbell Row','Back','Barbell'],['Dumbbell Shrug','Traps','Dumbbell'],
 ['Shoulder Press Machine','Shoulders','Machine'],['Cable Lateral Raise','Shoulders','Cable'],['Reverse Pec Deck','Rear Delts','Machine'],
 ['Barbell Squat','Quadriceps','Barbell'],['Leg Press','Quadriceps','Machine'],['Leg Extension','Quadriceps','Machine'],['Leg Curl','Hamstrings','Machine'],['Seated Calf Raise','Calves','Machine'],
 ['Barbell Curl','Biceps','Barbell'],['Hammer Curl','Biceps','Dumbbell'],['Cable Triceps Pushdown','Triceps','Cable'],['Overhead Triceps Extension','Triceps','Cable'],
 ['Hanging Knee Raise','Abs','Bodyweight'],['Ab Wheel Rollout','Abs','Bodyweight'],['Back Extension','Lower Back','Bodyweight']
].map((x,i)=>({id:'ex'+i,name:x[0],muscle:x[1],equipment:x[2],custom:false}));
const split=[['Monday','Push'],['Tuesday','Pull'],['Wednesday','Legs'],['Thursday','Rest'],['Friday','Upper Body'],['Saturday','Lower Body'],['Sunday','Rest']];
export const starterTemplates=[
 {id:'tpl-push',name:'Push Day',day:'Monday',exercises:[{exerciseId:'ex1',name:'Incline Smith Machine Press',muscle:'Chest',targetSets:3,targetReps:10},{exerciseId:'ex3',name:'Cable Fly',muscle:'Chest',targetSets:3,targetReps:12},{exerciseId:'ex10',name:'Shoulder Press Machine',muscle:'Shoulders',targetSets:3,targetReps:10},{exerciseId:'ex11',name:'Cable Lateral Raise',muscle:'Shoulders',targetSets:3,targetReps:12},{exerciseId:'ex21',name:'Cable Triceps Pushdown',muscle:'Triceps',targetSets:3,targetReps:12}]},
 {id:'tpl-pull',name:'Pull Day',day:'Tuesday',exercises:[{exerciseId:'ex5',name:'Lat Pulldown',muscle:'Back',targetSets:4,targetReps:10},{exerciseId:'ex7',name:'Seated Cable Row',muscle:'Back',targetSets:3,targetReps:10},{exerciseId:'ex19',name:'Barbell Curl',muscle:'Biceps',targetSets:3,targetReps:12}]},
 {id:'tpl-legs',name:'Leg Day',day:'Wednesday',exercises:[{exerciseId:'ex13',name:'Barbell Squat',muscle:'Quadriceps',targetSets:4,targetReps:8},{exerciseId:'ex14',name:'Leg Press',muscle:'Quadriceps',targetSets:3,targetReps:12},{exerciseId:'ex16',name:'Leg Curl',muscle:'Hamstrings',targetSets:3,targetReps:12},{exerciseId:'ex17',name:'Seated Calf Raise',muscle:'Calves',targetSets:3,targetReps:15}]}
];
export function loadData(){
 try { const d=JSON.parse(localStorage.getItem(KEY)); if(d) return d; } catch {}
 const d={exercises:defaultExercises,templates:starterTemplates,split:split.map(([day,workout])=>({day,workout})),workouts:[],profile:{name:'Athlete',weightKg:67,goal:'Lean muscle & strength'}};
 localStorage.setItem(KEY,JSON.stringify(d)); return d;
}
export function saveData(data){localStorage.setItem(KEY,JSON.stringify(data));}
export function exportData(data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ironcore-backup.json';a.click();URL.revokeObjectURL(url);}
