import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, vi } from 'vitest';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  AVATARES_PERFIL,
  AVATARES_VENDEDOR,
  AvatarSelector,
  avatarAleatorio,
} from './avatar-selector';

describe('AvatarSelector', () => {
  let fixture: ComponentFixture<AvatarSelector>;
  let component: AvatarSelector;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarSelector],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(AvatarSelector);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('permite elegir uno de los avatares disponibles', () => {
    const emitido: string[] = [];
    component.valueChange.subscribe((value) => emitido.push(value));

    component.seleccionarAvatar(AVATARES_PERFIL[0].ruta);

    expect(emitido).toEqual([AVATARES_PERFIL[0].ruta]);
  });

  it('muestra avatares diferentes para vendedores y clientes', () => {
    fixture.componentRef.setInput('esVendedor', true);
    fixture.detectChanges();

    const imagenes = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.opcion-avatar img'),
    );
    expect(imagenes).toHaveLength(AVATARES_VENDEDOR.length);
    expect(imagenes.map((imagen) => imagen.getAttribute('src'))).toEqual(
      AVATARES_VENDEDOR.map((avatar) => avatar.ruta),
    );
    expect(AVATARES_VENDEDOR.map((avatar) => avatar.ruta)).not.toEqual(
      expect.arrayContaining(AVATARES_PERFIL.map((avatar) => avatar.ruta)),
    );
  });

  it('elige por defecto avatares aleatorios del grupo correspondiente', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(avatarAleatorio()).toBe(AVATARES_PERFIL[0].ruta);
    expect(avatarAleatorio(true)).toBe(AVATARES_VENDEDOR[0].ruta);
  });

  it('lee y emite una foto propia como data URL', () => {
    class LectorFalso {
      result: string | ArrayBuffer | null = null;
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;

      readAsDataURL(): void {
        this.result = 'data:image/png;base64,aW1hZ2U=';
        this.onload?.({} as ProgressEvent<FileReader>);
      }
    }
    vi.stubGlobal('FileReader', LectorFalso);
    const archivo = new File(['imagen'], 'foto.png', { type: 'image/png' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [archivo] });
    const emitido: string[] = [];
    component.valueChange.subscribe((value) => emitido.push(value));

    component.cargarFoto({ target: input } as unknown as Event);

    expect(emitido).toEqual(['data:image/png;base64,aW1hZ2U=']);
    expect(input.value).toBe('');
  });

  it('rechaza archivos que no sean formatos de imagen compatibles', () => {
    const archivo = new File(['texto'], 'foto.txt', { type: 'text/plain' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [archivo] });

    component.cargarFoto({ target: input } as unknown as Event);

    expect(component.error()).toContain('JPG, PNG o WebP');
  });
});
