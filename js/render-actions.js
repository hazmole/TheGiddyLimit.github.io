class RenderActions {
	static $getRenderedAction (it) {
		return $$`
		${Renderer.utils.getBorderTr()}
		${Renderer.utils.getNameTr(it)}
		<tr><td class="divider" colspan="6"><div></div></td></tr>
		<tr class="text"><td colspan="6">${Renderer.get().setFirstSection(true).render({entries: it.entries})}</td></tr>
		${Renderer.utils.getPageTr(it)}
		${Renderer.utils.getBorderTr()}
		`
	}
}
