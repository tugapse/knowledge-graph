# KnowledgeGraph

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.11.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

`npm run build` compiles the Angular client into `dist/knowledge-graph/browser` (minified, hashed, relative `base href` so it works from any sub-path).

The Python entry point drives it:

```bash
./run.sh -k ./knowledge -d ./docs                    # serve on :8080 (builds the client if no build exists)
./run.sh -k ./knowledge -d ./docs --rebuild-client   # npm run build, then serve
./run.sh -k ./knowledge -d ./docs -b ./dist/site     # npm run build + data.json -> static bundle
./run.sh -k ./knowledge -b ./dist/site --skip-client-build   # refresh data.json only
```

The static bundle is plain files; host it with any web server (e.g. `python3 -m http.server -d dist/site`).

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
