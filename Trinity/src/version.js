export const TRINITY_VERSION='10.0.1';

export function releaseMetadata(env){
  const version=env.CF_VERSION_METADATA;
  return {id:version?.id||null,tag:version?.tag||null,timestamp:version?.timestamp||null};
}
