import {useLayoutEffect, useRef, type ReactNode} from 'react'
import {X} from 'lucide-react'

type Props = {
  id: string
  className: string
  title: string
  description: string
  onCancel: () => void
  children: ReactNode
  actions: ReactNode
}

export default function EditorDialog({id, className, title, description, onCancel, children, actions}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])

  return (
    <dialog
      ref={dialog}
      className={`import-modal editor-dialog ${className}`}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={event => {event.preventDefault(); onCancel()}}
    >
      <header className="editor-dialog-header">
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p id={`${id}-description`}>{description}</p>
        </div>
        <button type="button" className="btn editor-icon-button" aria-label="Cerrar" onClick={onCancel}>
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      <div className="editor-dialog-body">{children}</div>
      <footer className="editor-dialog-footer">{actions}</footer>
    </dialog>
  )
}
