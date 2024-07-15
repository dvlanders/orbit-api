# hifi_backend

# Start Application using command

npm i
npm run start

# Test

### Environment Specification

In the test commands below, replace `<env>` with the desired environment. Use `prod` for the production environment and `sandbox` for the sandbox environment.

### To run all endpoint tests for a specific environment, use the following commands:

- For production environment:

```console
npm test prod
```

- For sandbox environment:

```console
npm test sandbox
```

### To run tests for specific endpoint(s), use the following commands:

Note: Remember to replace `<env>` with prod or sandbox depending on your testing environment.

- For all account endpoints (note: remember the / after the folder name):

```console
npm test <env> -- account/
```

- For all user endpoints:

```console
npm test <env> -- user/
```

- For all transfer endpoints:

```console
npm test <env> -- transfer/
```

### To run a test for a single endpoint, specify the path. For example, to test the `ping` endpoint in the user section:

```console
npm test <env> -- user/ping
```

### To run prod full-flow test (Create User -> Add Account -> Transfer)

```console
npm test prod -- full-flow
```
