import { Injectable, NgZone } from '@angular/core';
import { AiHistory } from '../interfaces/ai-history.interface';
import { Observable, take } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class AiService {
  constructor(private zone: NgZone, private http: HttpClient) {}

  getMessages(): Observable<any> {
    return new Observable((observer: any) => {
      let source = new EventSource(
        'http://localhost:8080/api/Ai/streamChatEvents'
      );
      source.onmessage = (event) => {
        this.zone.run(() => {
          observer.next(event.data);
        });
      };
      source.onerror = (event) => {
        this.zone.run(() => {
          observer.error(event);
        });
      };
    });
  }

  sendMessage(model: string, history: AiHistory[]) {
    return this.http.post(
      'http://localhost:8080/api/Ai/postStreamChat',
      {
        model: model,
        history: history,
      },
      { responseType: 'text' }
    );
  }
}
