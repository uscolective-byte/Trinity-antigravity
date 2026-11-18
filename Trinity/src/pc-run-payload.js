import {HttpError} from './security.js';

const pcRunTasks = new Map(Object.entries({
  'node --version':'node-version',
  'node -v':'node-version',
  'python --version':'python-version',
  'cmd /c ver':'cmd-version',
  'npm run build':'build',
  'npm test':'tests',
  'npm run deploy':'deploy',
  'npm run start':'run-start',
  'npm start':'start',
  'docker compose up':'docker-compose-up',
  'docker compose ps':'docker-compose-ps',
  'docker ps':'docker-ps',
  'git log -n 5':'git-log',
  'git status --short':'git-status',
  'git diff --check':'diff-check'
}));

export function pcRunPayload(command,cwd) {
  const task=pcRunTasks.get(command.trim());
  if(!task)throw new HttpError(400,'Miestna brána povoľuje iba príkazy zo zoznamu PC úloh.');
  if(cwd&&!['Trinity','Local-Gateway'].includes(cwd))throw new HttpError(400,'Použi relatívny projekt Trinity alebo Local-Gateway.');
  return {project:cwd||'Trinity',task};
}
