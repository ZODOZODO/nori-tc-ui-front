import { useEffect, useState } from 'react'
import { Group, Image as KonvaImage, Line, Rect, Text } from 'react-konva'
import type { RectConfig } from 'konva/lib/shapes/Rect'
import type { LineConfig } from 'konva/lib/shapes/Line'
import type { TextConfig } from 'konva/lib/shapes/Text'
import type { ImageConfig } from 'konva/lib/shapes/Image'
import type { ContainerConfig } from 'konva/lib/Container'
import type { KonvaEventObject, Node as KonvaNodeRef } from 'konva/lib/Node'
import type { KonvaNode } from '../lib/live-map-layout.model'

/**
 * shape_json(Konva 직렬화) ↔ react-konva 렌더의 정본 해석입니다 — 저작(빌더)과 표시(뷰어 구조물 레이어)가
 * 동일하게 그리도록 단일 소스로 둡니다. JSONB 스키마는 동결안이라 분기 위험은 낮지만, 둘이 갈라지면
 * "편집 모습 ≠ 보이는 모습" 버그가 되므로 한 곳에서만 매핑한다.
 */

/** draft primitive 를 캔버스에서 직접 편집(드래그/리사이즈/회전)하기 위한 Konva 노드 props. */
export interface KonvaPrimitiveEditProps {
  ref: (node: KonvaNodeRef | null) => void
  draggable: boolean
  onClick: (event: KonvaEventObject<MouseEvent>) => void
  onTap: () => void
  onDragEnd: (event: KonvaEventObject<DragEvent>) => void
  onTransformEnd: (event: KonvaEventObject<Event>) => void
}

/** shape_json 의 Image primitive — src URL 로 이미지를 로드해 Konva Image 로 렌더한다. */
export function PrimitiveImage({
  attrs,
  nodeProps,
}: {
  attrs: Record<string, unknown>
  nodeProps?: KonvaPrimitiveEditProps
}) {
  const src = typeof attrs.src === 'string' ? attrs.src : ''
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (src.length === 0) {
      return
    }
    const element = new window.Image()
    element.src = src
    // setImage 는 load 이벤트(비동기 콜백)에서만 호출 — 동기 setState-in-effect 회피.
    const handleLoad = () => setImage(element)
    element.addEventListener('load', handleLoad)
    return () => element.removeEventListener('load', handleLoad)
  }, [src])

  if (!image) {
    return null
  }
  const { src: _src, ...rest } = attrs
  void _src
  return <KonvaImage {...(rest as ImageConfig)} {...nodeProps} image={image} />
}

/** shape_json 노드(KonvaNode) 1개를 read-only react-konva 엘리먼트로 렌더한다(빌더/뷰어 공용). */
export function KonvaPrimitive({ node }: { node: KonvaNode }) {
  switch (node.className) {
    case 'Rect':
      return <Rect {...(node.attrs as RectConfig)} />
    case 'Line':
      return <Line {...(node.attrs as LineConfig)} />
    case 'Text':
      return <Text {...(node.attrs as TextConfig)} />
    case 'Image':
      return <PrimitiveImage attrs={node.attrs} />
    case 'Group':
      return (
        <Group {...(node.attrs as ContainerConfig)}>
          {(node.children ?? []).map((child, index) => (
            <KonvaPrimitive key={index} node={child} />
          ))}
        </Group>
      )
    default:
      return null
  }
}
