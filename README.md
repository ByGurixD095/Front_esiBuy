# FrontEsiBuy

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.0.

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

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## CI/CD with GitHub Actions and Firebase Hosting

The workflow in `.github/workflows/firebase-hosting.yml` builds pull requests targeting `master` or `develop` and publishes a Firebase Hosting preview for pull requests from this repository. After a push to `master`, it deploys the production site to Firebase Hosting. The Hosting configuration serves the Angular build from `dist/Front_esiBuy/browser` and routes application paths back to `index.html`.

In **GitHub → Settings → Secrets and variables → Actions**, create the repository secret `FIREBASE_SERVICE_ACCOUNT_ESIBUY` with the JSON service-account key that has permission to deploy to Firebase project `esibuy`. The project reference is stored in `.firebaserc`.

The production build uses `https://back-esibuy.onrender.com` as its API URL. To override it for GitHub Actions, open **GitHub → Settings → Secrets and variables → Actions → Variables**, create a repository variable named `API_URL`, and set it to the public backend base URL without a trailing slash. Do not create it as a secret: the URL is included in the public frontend bundle and must not contain credentials or other secrets. Configure the backend CORS policy to allow the Firebase Hosting domain.

The frontend sends API requests with credentials. In production, it obtains a CSRF token before unsafe requests and retries once if the backend reports a missing CSRF cookie or a token mismatch. Local development skips CSRF because the backend `dev` profile disables it. The production backend must allow the Firebase origin with credentials and issue secure cookies.

Firebase Hosting revalidates the HTML and other non-hashed files whenever the browser requests them. Hashed JavaScript and CSS bundles can be cached for a year because each new build gets new filenames; reopening or reloading the site gets the current HTML and its matching bundles. The app shell displays the Angular route directly and does not include the old animated “EsiBuy · Equipo 5” screensaver.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## User registration

The `/register` page lets visitors choose between creating a customer account and registering as a seller.
The customer form submits to `POST /users/register/clientes` with personal details, DNI, and birth date.
The seller form submits to `POST /users/register/vendedor` with commercial name, CIF/NIF, and primary category ID.
Both requests also include the optional phone and profile-image URL fields. When registration succeeds,
the frontend signs in with `POST /users/login`, sends credentials with cookies enabled, and navigates to
the products page when `mfaStatus` is `SUCCESS`. The login flow also supports the MFA setup,
verification, and backup-code steps required by the backend.

## Category administration

Administrators can create a category at `/admin/categorias/nueva` using
`POST /admin/categorias`. Category names must be unique.

## Checkout and orders

Customers manage saved shipping addresses at `/account/direcciones` through
`/users/me/direcciones`. Checkout requires one saved address and a saved payment
method. Creating an order reserves stock and empties the cart; the customer
then confirms the simulated payment with `POST /pedidos/{pedidoId}/pagar`.
No payment provider or real charge is involved.

Customer active orders and history are separate in `/pedidos`. Customers can
cancel eligible unpaid or paid orders before any line is shipped and confirm
delivery after all sellers have shipped their lines. Sellers use
`/pedidos-vendedor` to view their own active lines, mark them as shipped, and
consult their history.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
