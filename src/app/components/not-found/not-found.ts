import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarcoPagina } from '../marco-pagina/marco-pagina';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, MarcoPagina],
  templateUrl: './not-found.html',
  styleUrl: './not-found.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFound {}
