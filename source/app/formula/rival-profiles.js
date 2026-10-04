// Driver choices differ; engine power, tyre grip and traffic clearance do not.
const balanced={style:'balanced',anticipation:.4,attackAnticipation:.15,attackGap:35,attackRange:42,preferExit:false,defenseRange:60,counterDistance:180,boostRange:60,boostReserve:0};
export const RIVAL_PROFILES=Object.freeze({
  SATO:Object.freeze({...balanced,style:'late-braker'}),
  MORGAN:Object.freeze({...balanced,style:'exit-specialist',anticipation:.45,attackAnticipation:.25,attackGap:25,attackRange:32,preferExit:true,defenseRange:45,counterDistance:220,boostRange:45,boostReserve:20}),
  SILVA:Object.freeze({...balanced,style:'opportunist',attackAnticipation:.2,attackGap:28,defenseRange:50,counterDistance:260,boostRange:35,boostReserve:40}),
});
const DEFAULT_PROFILE=Object.freeze(balanced);
export const driverProfile=rival=>rival.profile??DEFAULT_PROFILE;
