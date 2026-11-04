import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CloudinaryService {
  private readonly http = inject(HttpClient);

  subirImagen(archivo: File, carpeta: string): Observable<string> {
    const url = `https://api.cloudinary.com/v1_1/${environment.cloudinaryCloudName}/image/upload`;
    const formData = new FormData();
    formData.append('file', archivo);
    formData.append('upload_preset', environment.cloudinaryUploadPreset);
    formData.append('folder', carpeta);

    return this.http.post<{ secure_url: string }>(url, formData).pipe(
      map(res => res.secure_url)
    );
  }
}