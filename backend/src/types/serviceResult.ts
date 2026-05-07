// ______ Risultato standard dei service: successo con data o fallimento con reason ______
// ______ Usato per mappare in modo tipizzato esiti business -> status HTTP ______
export type ServiceSuccess<T> = {
  ok: true;
  data: T;
};

export type ServiceFailure<E extends string> = {
  ok: false;
  reason: E;
};

export type ServiceResult<T, E extends string> = ServiceSuccess<T> | ServiceFailure<E>;
