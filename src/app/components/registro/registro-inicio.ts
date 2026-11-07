import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarcoPagina } from '../marco-pagina/marco-pagina';

@Component({
  selector: 'app-registro-inicio',
  imports: [RouterLink, MarcoPagina],
  template: `
    <app-marco-pagina [volver]="true">
      <div class="pagina">
        <p class="esi-eyebrow">Registro</p>
        <h1 class="esi-titulo">crear <em>cuenta.</em></h1>

        <section class="selector esi-tarjeta" aria-labelledby="titulo-selector">
          <header class="selector-cabecera">
            <h2 id="titulo-selector">Elige tu tipo de cuenta</h2>
          </header>

          <div class="opciones">
            <a class="opcion opcion-cliente" routerLink="/register/clientes">
              <span class="opcion-texto">
                <span class="opcion-titulo">Cliente</span>
                <span class="opcion-accion">Registrarme <span aria-hidden="true">→</span></span>
              </span>
            </a>

            <a class="opcion opcion-vendedor" routerLink="/register/vendedor">
              <span class="opcion-texto">
                <span class="opcion-titulo">Vendedor</span>
                <span class="opcion-accion"
                  >Registrar tienda <span aria-hidden="true">→</span></span
                >
              </span>
            </a>
          </div>
          <a class="enlace-login" routerLink="/login"
            >¿Ya tienes cuenta? Volver al inicio de sesión</a
          >
        </section>
      </div>
    </app-marco-pagina>
  `,
  styles: `
    :host {
      display: block;
    }

    .pagina {
      max-width: 560px;
      margin: 0 auto;
      text-align: center;
    }

    .selector {
      padding: 24px;
      text-align: center;
      background: transparent;
      border: 0;
      box-shadow: none;
    }

    .selector-cabecera {
      margin-bottom: 18px;
    }

    .selector h2 {
      margin: 0;
      font-family: var(--esi-font-title);
      font-size: 20px;
      font-weight: 400;
    }

    .opciones {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .enlace-login {
      display: inline-block;
      margin-top: 22px;
      color: var(--esi-orange-text);
      font-size: 14px;
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    .enlace-login:hover {
      color: var(--esi-orange-hover);
    }

    .enlace-login:focus-visible {
      outline: 2px solid var(--esi-orange);
      outline-offset: 3px;
    }

    .opcion {
      display: flex;
      min-height: 112px;
      box-sizing: border-box;
      align-items: center;
      justify-content: center;
      padding: 18px;
      color: var(--esi-ink);
      background: #fffefa;
      border: 1px solid #d8d9d5;
      border-radius: 10px;
      box-shadow: 0 1px 3px rgb(23 33 38 / 5%);
      text-decoration: none;
      transition:
        border-color 140ms ease,
        background-color 140ms ease;
    }

    .opcion:hover {
      background: #faf8f3;
      border-color: #b9bcb8;
    }

    .opcion:focus-visible {
      outline: 3px solid var(--esi-orange-text);
      outline-offset: 2px;
    }

    .opcion-texto {
      display: flex;
      width: 100%;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .opcion-titulo {
      font-size: 16px;
      font-weight: 700;
    }

    .opcion-accion {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #9f4528;
      font-size: 12px;
      font-weight: 700;
    }

    .opcion-accion span {
      font-size: 15px;
      transition: transform 140ms ease;
    }

    .opcion:hover .opcion-accion span {
      transform: translateX(3px);
    }

    @media (max-width: 600px) {
      .selector {
        padding: 20px 0;
      }

      .opciones {
        grid-template-columns: minmax(0, 1fr);
      }

      .opcion {
        min-height: 88px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .opcion,
      .opcion-accion span {
        transition: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroInicio {}
