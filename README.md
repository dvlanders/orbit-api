# hifi_backend

# Start Application using command

npm i
npm run start

# Test

### To run all tests, use the following command:

```console
npm test
```

### To run tests for specific endpoint(s), use the following commands:

- For all account endpoints (note: remember the / after the folder name):

```console
npm test -- account/
```

- For all user endpoints:

```console
npm test -- user/
```

- For all transfer endpoints:

```console
npm test -- transfer/
```

### To run a test for a single endpoint, specify the path. For example, to test the `ping` endpoint in the user section:

```console
npm test -- user/ping
```
