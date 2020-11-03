import { Message } from 'google-protobuf';
import { Metadata, ServiceError } from 'grpc';
import { Any } from 'google-protobuf/google/protobuf/any_pb';
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

export const googleErrorDetailsNameMap = {
  RetryInfo: 'google.rpc.RetryInfo',
  DebugInfo: 'google.rpc.DebugInfo',
  QuotaFailure: 'google.rpc.QuotaFailure',
  PreconditionFailure: 'google.rpc.PreconditionFailure',
  BadRequest: 'google.rpc.BadRequest',
  RequestInfo: 'google.rpc.RequestInfo',
  ResourceInfo: 'google.rpc.ResourceInfo',
  Help: 'google.rpc.Help',
  LocalizedMessage: 'google.rpc.LocalizedMessage',
};

const notEmpty = <TValue>(
  value: TValue | null | undefined,
): value is TValue => value !== null && value !== undefined;

export const GRPC_ERROR_DETAILS_KEY = 'grpc-status-details-bin';

export default class StatusProto {
  private status: Status | undefined;

  private code: number;

  private message: string;

  private details: Message[];

  constructor(status: Status) {
    this.status = status;
    this.code = status.getCode();
    this.message = status.getMessage();
    this.details = [];
  }

  getCode() {
    return this.code;
  }

  getMessage() {
    return this.message;
  }

  getDetails() {
    return this.details;
  }

  addDetail(detail: Message) {
    if (!this.details) this.details = [];
    this.details.push(detail);
    return this;
  }

  addDetails(details: Message[]) {
    if (!this.details) this.details = [];
    this.details.push(...details);
    return this;
  }
}

export function deserializeGrpcStatusDetails<
  // eslint-disable-next-line space-before-function-paren
  TMap extends Record<string, (bytes: Uint8Array) => Message>
>(
  error: ServiceError,
  deserializeMap: TMap): StatusProto | null {
  if (!error.metadata) {
    return null;
  }

  const buffer = error.metadata.get(GRPC_ERROR_DETAILS_KEY)[0];

  if (!buffer || typeof buffer === 'string') {
    return null;
  }

  const status: Status | undefined = Status.deserializeBinary(buffer);

  const statusProto = new StatusProto(status);

  const details = status
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

  return statusProto.addDetails(details);
}

export function deserializeGoogleGrpcStatusDetails(error: ServiceError) {
  return deserializeGrpcStatusDetails(error, googleDeserializeMap);
}

export function serializeGrpcStatusDetails<
  TMap extends Record<string, string>
>(statusProto: StatusProto, namesMap: TMap) {
  const error: ServiceError = {
    name: 'ServiceError',
    code: this.code,
    message: this.message,
    details: this.message,
  };
  error.metadata = new Metadata();

  const protoStatus = new Status();
  protoStatus.setCode(this.code);
  protoStatus.setMessage(this.message);
  statusProto.getDetails().forEach((detail) => {
    const a = new Any();
    a.pack(detail.serializeBinary(), namesMap[detail.constructor.name]);
    protoStatus.addDetails(a);
  });
  error.metadata.add(GRPC_ERROR_DETAILS_KEY, Buffer.from(protoStatus.serializeBinary()));

  return error;
}
