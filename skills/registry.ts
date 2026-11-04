import { ApplicationBuilderSkill, applicationBuilderSkill } from "./appBuilder";

export interface Skill {
  id: string;
  name: string;
  description: string;
  execute: (args: any) => Promise<any> | any;
}

export const BUILTIN_SKILLS: Skill[] = [
  {
    id: "system_shell",
    name: "PowerShell System Executor",
    description: "Umožňuje TRINITY bezpečne vykonávať príkazy v lokálnom PowerShell prostredí.",
    execute: async (args: { command: string }) => {
      console.log(\[TRINITY Tool] Vykonávam PowerShell príkaz: \\);
      return { success: true, executed: args.command };
    }
  },
  {
    id: "app_builder",
    name: "Application Builder",
    description: "Generuje a spúšťa produkčné multi-file aplikácie.",
    execute: async (args: any) => {
      return applicationBuilderSkill.buildFullStackApp(args);
    }
  }
];
