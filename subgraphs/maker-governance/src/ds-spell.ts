import { Spell } from "../generated/schema";
import { CastCall, ScheduleCall } from "../generated/DSChief/DSSpell";
import { SpellState } from "./constants";

export function handleSchedule(call: ScheduleCall): void {
  let spellID = call.to.toHexString(); // spell address is the spellID
  let spell = Spell.load(spellID);
  if (!spell) return;
  spell.state = SpellState.SCHEDULED;
  spell.scheduledTxnHash = call.transaction.hash.toHexString();
  spell.scheduledTime = call.block.timestamp;
  spell.save();
}

export function handleCast(call: CastCall): void {
  let spellID = call.to.toHexString(); // spell address is the spellID
  let spell = Spell.load(spellID);
  if (!spell) return;
  spell.state = SpellState.CAST;
  spell.castTxnHash = call.transaction.hash.toHexString();
  spell.castTime = call.block.timestamp;
  spell.castWith = spell.totalWeightedVotes;
  spell.save();
}