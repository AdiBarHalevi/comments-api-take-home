import type { AppRequest } from '../types/request.js'
import * as postsService from './service.js'
import type { ListPostsRequest } from './types.js'

export function createPostsHandlers() {
  return {
    async getPosts(
      request: AppRequest<{ Querystring: ListPostsRequest }>
    ) {
      return postsService.listPosts({
        request,
        query: request.query
      })
    }
  }
}
