color: true
hookfiles: []
dry-run: null
language: nodejs
require: ./babel-register.js
server-wait: 3
init: false
custom: {}
names: false
only: [
  # If a resource has only one example, it will be of the form
  # Ping > Prove deployments work
  # If it has multiple examples, it will be of the form
  # Ping > Prove deployments work > Example 1
]
reporter:
  - xunit
  - apiary
output:
  - reports/junit/dredd.xml
header: []
sorted: true
user: null
inline-errors: false
details: false
method: []
loglevel: warning
path: []
hooks-worker-timeout: 5000
hooks-worker-connect-timeout: 1500
hooks-worker-connect-retry: 500
hooks-worker-after-connect-wait: 100
hooks-worker-term-timeout: 5000
hooks-worker-term-retry: 500
hooks-worker-handler-host: 127.0.0.1
hooks-worker-handler-port: 61321
config: ./dredd.yml
blueprint: apiary.apib
endpoint: ${{ endpoint }}
