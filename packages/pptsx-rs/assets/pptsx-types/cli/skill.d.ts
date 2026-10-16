import { type SkillDs } from '../skill/skill.ts';
/** M18-8: `pptsx skill --out <pasta> [--ds <pacote|caminho>] [--name nome] [--release-url base]`. */
export declare const SKILL_USAGE = "uso: pptsx skill --out <pasta> [--ds <pacote|caminho>] [--name nome] [--release-url base]";
export interface SkillArgs {
    readonly out: string;
    readonly ds?: string;
    readonly name?: string;
    readonly releaseUrl?: string;
}
export declare const parseSkillCli: (argv: readonly string[], cwd?: string) => SkillArgs;
export declare const loadSkillDs: (spec: string, cwd: string) => Promise<SkillDs>;
export declare const runSkill: (args: SkillArgs, cwd: string) => Promise<number>;
