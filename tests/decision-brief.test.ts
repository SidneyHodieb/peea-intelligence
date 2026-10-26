import { expect, it } from 'vitest';
import { decisionBrief, eventOpportunity } from '../lib/decision-brief';
import type { EventRecord } from '../lib/types';
const now=Date.parse('2026-10-26T12:00:00Z');
const event=(id:string,title:string,score=50):EventRecord=>({id,title,score,date:'2026-11-01T10:00:00Z',city:'Paris',region:'',venue:'',organizer:'',category:'',countries:[],description:'',sourceCount:1,verification:'À vérifier',updatedAt:'',scoreReasons:[]});
it('prioritizes diaspora investment over a higher generic score and excludes past or contradictory recommendations',()=>{
 const core=event('core','Diaspora : financer les projets',40);
 const other=event('other','Investissement Afrique',95);
 const past={...core,id:'past',date:'2026-10-01T10:00:00Z'};
 const contradictory={...core,id:'conflict',verification:'Contradictoire' as const};
 const brief=decisionBrief([other,past,contradictory,core],now);
 expect(brief.ranked.map(e=>e.id)).toEqual(['core','other']);
 expect(brief.urgent).toHaveLength(2);
 expect(brief.uncertain).toHaveLength(3);
});
it('does not mark a generic business event as a core PEEA opportunity',()=>{
 expect(decisionBrief([event('generic','Rencontres des entreprises',100)],now).core).toHaveLength(0);
});

it('does not elevate a primarily cultural diaspora event from a peripheral investment mention',()=>{
 const cultural={...event('culture','Festival du patrimoine béninois',90),description:'Culture, traditions, gastronomie, diaspora et investissement.'};
 expect(eventOpportunity(cultural).tier).toBe(2);
});
