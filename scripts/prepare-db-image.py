"""Import a flattened official OCI filesystem, retaining its runtime configuration.
Usage: python3 scripts/prepare-db-image.py CONFIG_JSON ROOTFS_TAR IMAGE SOURCE_DIGEST
crane export must obtain CONFIG_JSON and ROOTFS_TAR from the same immutable digest.
"""
import json
from pathlib import Path
import subprocess
import sys

config = json.loads(Path(sys.argv[1]).read_text())['config']
changes = []
for env in config.get('Env') or []:
    name, value = env.split('=', 1)
    changes.append('ENV ' + name + '=' + json.dumps(value))
for field, instruction in [('Entrypoint', 'ENTRYPOINT'), ('Cmd', 'CMD')]:
    if config.get(field):
        changes.append(instruction + ' ' + json.dumps(config[field]))
for field, instruction in [('User', 'USER'), ('WorkingDir', 'WORKDIR'), ('StopSignal', 'STOPSIGNAL')]:
    if config.get(field):
        changes.append(instruction + ' ' + config[field])
for port in config.get('ExposedPorts') or {}:
    changes.append('EXPOSE ' + port)
if config.get('Volumes'):
    changes.append('VOLUME ' + json.dumps(list(config['Volumes'])))
for name, value in (config.get('Labels') or {}).items():
    changes.append('LABEL ' + name + '=' + json.dumps(value))
health = config.get('Healthcheck')
if health:
    test = health['Test']
    if test == ['NONE']:
        changes.append('HEALTHCHECK NONE')
    else:
        options = []
        for field, flag in [('Interval','interval'),('Timeout','timeout'),('StartPeriod','start-period'),('StartInterval','start-interval')]:
            if health.get(field):
                options.append('--' + flag + '=' + str(health[field]) + 'ns')
        if health.get('Retries'):
            options.append('--retries=' + str(health['Retries']))
        command = json.dumps(test[1:]) if test[0] == 'CMD' else test[1]
        changes.append('HEALTHCHECK ' + ' '.join(options) + ' CMD ' + command)
if config.get('OnBuild'):
    raise RuntimeError('Unexpected OnBuild config requires explicit review')
args = ['docker', 'import']
for change in changes:
    args.extend(['--change', change])
subprocess.run([*args, sys.argv[2], sys.argv[3]], check=True, stdout=subprocess.DEVNULL)
actual = json.loads(subprocess.check_output(['docker','image','inspect',sys.argv[3]],text=True))[0]['Config']
for field in ['Env','Entrypoint','Cmd','User','WorkingDir','StopSignal','Volumes','ExposedPorts','Healthcheck']:
    expected, found = config.get(field), actual.get(field)
    if field == 'Env':
        expected, found = sorted(expected or []), sorted(found or [])
    if (expected or None) != (found or None):
        raise RuntimeError('Imported runtime configuration mismatch: ' + field)
Path('.tools/postgres-image-source.json').write_text(json.dumps({'source':sys.argv[4],'flattened':True},indent=2)+'\n')
print('Official database filesystem imported; runtime configuration verified.')
