import { ServiceError } from 'grpc';
import { Status } from './google/status_pb';
import {
  RetryInfo,
  DebugInfo,
  QuotaFailure,
  PreconditionFailure,
  BadRequest,
  RequestInfo,
  ResourceInfo,
  Help,
  LocalizedMessage,
} from './google/error_details_pb';

export const googleDeserializeMap = {
  'google.rpc.RetryInfo': RetryInfo.deserializeBinary,
  'google.rpc.DebugInfo': DebugInfo.deserializeBinary,
  'google.rpc.QuotaFailure': QuotaFailure.deserializeBinary,
  'google.rpc.PreconditionFailure': PreconditionFailure.deserializeBinary,
  'google.rpc.BadRequest': BadRequest.deserializeBinary,
  'google.rpc.RequestInfo': RequestInfo.deserializeBinary,
  'google.rpc.ResourceInfo': ResourceInfo.deserializeBinary,
  'google.rpc.Help': Help.deserializeBinary,
  'google.rpc.LocalizedMessage': LocalizedMessage.deserializeBinary,
};

// interface ServiceError {
//   metadata?: Metadata;
// }

const notEmpty = <TValue>(
  value: TValue | null | undefined,
): value is TValue => value !== null && value !== undefined;

export function deserializeGrpcStatusDetails<
  // eslint-disable-next-line space-before-function-paren
  TMap extends Record<string, (bytes: Uint8Array) => ReturnType<TMap[keyof TMap]>>
>(
  error: ServiceError,
  deserializeMap: TMap): {
    status: Status;
    details: Array<ReturnType<TMap[keyof TMap]>>;
  } | null {
  if (!error.metadata) {
    return null;
  }

  const buffer = error.metadata.get('grpc-status-details-bin')[0];

  if (!buffer || typeof buffer === 'string') {
    return null;
  }

  const status: Status | undefined = Status.deserializeBinary(buffer);

  const details: Array<ReturnType<TMap[keyof TMap]>> = status
    .getDetailsList()
    .map((detail) => {
      const deserialize = deserializeMap[detail.getTypeName()];
      if (deserialize) {
        const message = detail.unpack(deserialize, detail.getTypeName());

        return message;
      }
      return null;
    })
    .filter(notEmpty);

  return {
    status,
    details,
  };
}

export function deserializeGoogleGrpcStatusDetails(error: ServiceError) {
  return deserializeGrpcStatusDetails(error, googleDeserializeMap);
}
