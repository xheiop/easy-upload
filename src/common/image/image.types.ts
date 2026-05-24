export interface TokenSecret {
  token_id: string;
  token_secret: string;
}

export interface ImgBoxResponse {
  files: {
    original_url: string;
    thumbnail_url: string;
  }[];
}

export interface PixHostResponse {
  images: PixhostDataImage[];
}

export interface PixhostDataImage {
  th_url: string;
  show_url: string;
}

export interface CheveretoResponse {
  status_txt: string;
  image: {
    url: string;
    thumb: {
      url: string;
    };
  };
}

export interface ImgInfo {
  thumbnail: string;
  original: string;
}

export interface UrlTransformStrategy {
  matches(url: string, bbcode: string): boolean;
  transform(url: string, bbcode?: string): Promise<string>;
}
