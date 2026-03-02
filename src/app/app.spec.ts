import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { DataContextService } from '@ws/data-access';

import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App, RouterModule.forRoot([])],
      providers: [DataContextService],
    }).compileComponents();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Wellesley Softball Stats Hub'
    );
  });
});
