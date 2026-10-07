import { Routes } from '@angular/router';
import { AdministradorRegistro } from './administrador-registro/administrador-registro';
import { InicioSesion } from './inicio-sesion/inicio-sesion';
import { ProductoForm } from './producto-form/producto-form';

export const routes: Routes = [
  { path: '', pathMatch: 'full', children: [] },
  { path: 'administradores/nuevo', component: AdministradorRegistro },
  { path: 'login', component: InicioSesion },
  {path: 'products', component: ProductoForm,},
];
