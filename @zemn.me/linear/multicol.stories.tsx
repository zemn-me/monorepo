import style from './style'
import React from 'react'
import { Div, P } from './elements'

export default {
	title: 'multicol',
}

const Lipsum = () => (
	<>
		<P>
			Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut
			dignissim tristique congue. Sed dignissim risus non vestibulum
			vehicula. Proin vel nisi odio. Vestibulum rutrum ex eu velit
			scelerisque molestie. Aenean mi est, volutpat a volutpat non,
			venenatis non orci. Cras leo leo, pellentesque at velit ac, accumsan
			ultricies ex. Sed euismod a mi id ornare. Nullam sed diam et eros
			ornare tempor. Morbi et accumsan lectus. Sed malesuada neque quis
			diam elementum viverra. Nullam suscipit metus at vestibulum
			efficitur. Proin nec nibh imperdiet, interdum ipsum eget, vulputate
			mauris. Integer rutrum lacinia eleifend.
		</P>

		<P>
			Cras sodales at lectus vel accumsan. Nam lectus mauris, semper et
			enim sed, fermentum euismod lectus. Nullam cursus pellentesque
			lobortis. Vestibulum elementum tincidunt purus ut scelerisque.
			Suspendisse id ligula et leo faucibus vehicula a id ipsum. Nam
			venenatis sollicitudin urna at semper. Morbi vestibulum dignissim
			diam, et bibendum ipsum scelerisque vel. Integer non ultricies dui,
			posuere dapibus dolor. Mauris ultricies tortor sit amet feugiat
			suscipit. Pellentesque vitae ex eu sapien porttitor sagittis non ut
			lorem.
		</P>

		<P>
			Suspendisse congue nec arcu eget iaculis. Donec vel lorem
			pellentesque sapien tincidunt rhoncus vitae at ligula. Curabitur
			scelerisque ante mattis purus vulputate, sed tincidunt felis
			blandit. Phasellus quis nisi condimentum, gravida lacus non,
			fringilla arcu. Nulla id cursus leo, vitae blandit nisi. Nullam sed
			orci auctor, ullamcorper quam a, imperdiet arcu. Integer pharetra
			urna id urna malesuada, et vestibulum nisi molestie. Aenean et
			elementum purus, sed aliquet sapien. Sed accumsan mauris vitae leo
			consequat placerat. Vestibulum pretium volutpat lectus in fringilla.
			Curabitur nulla est, scelerisque vel sodales vitae, faucibus non
			felis. Quisque sem lorem, volutpat sed nisi id, convallis ultrices
			est. Nullam et lorem sed nulla sollicitudin malesuada et id sem. Sed
			ornare sodales tortor.
		</P>

		<P>
			Sed vehicula urna quis orci tincidunt, nec blandit ligula molestie.
			In consectetur, dui consequat rhoncus euismod, nibh nunc bibendum
			dolor, eget hendrerit est sapien non libero. Orci varius natoque
			penatibus et magnis dis parturient montes, nascetur ridiculus mus.
			Morbi vitae dolor rhoncus, ornare dui in, molestie sem. Sed ac
			vulputate odio, ac porta justo. Mauris blandit lacus risus, a
			rhoncus nisi iaculis ac. Nulla dolor magna, bibendum eu scelerisque
			vitae, ultrices eu metus. Quisque rutrum dui id purus tristique
			suscipit. Proin sodales purus nunc, sit amet blandit justo dapibus
			fermentum. Vestibulum quis augue nec ex pulvinar convallis. Cras
			porta pretium metus ac cursus. Sed elementum quam quis ex dapibus,
			eget tristique mi egestas. Maecenas varius pulvinar nisl eu mattis.
			Vestibulum a interdum odio.
		</P>

		<P>
			Aliquam sed cursus quam. Nulla accumsan lacus et feugiat lacinia.
			Duis facilisis ligula a pellentesque molestie. Aliquam sit amet
			turpis leo. Nam dapibus egestas massa, non fermentum sapien volutpat
			eu. Integer blandit sem eu orci venenatis, eu varius quam tempus.
			Sed quis euismod mauris. Maecenas hendrerit molestie fermentum.
			Nulla vel viverra justo.
		</P>

		<P>
			Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut
			dignissim tristique congue. Sed dignissim risus non vestibulum
			vehicula. Proin vel nisi odio. Vestibulum rutrum ex eu velit
			scelerisque molestie. Aenean mi est, volutpat a volutpat non,
			venenatis non orci. Cras leo leo, pellentesque at velit ac, accumsan
			ultricies ex. Sed euismod a mi id ornare. Nullam sed diam et eros
			ornare tempor. Morbi et accumsan lectus. Sed malesuada neque quis
			diam elementum viverra. Nullam suscipit metus at vestibulum
			efficitur. Proin nec nibh imperdiet, interdum ipsum eget, vulputate
			mauris. Integer rutrum lacinia eleifend.
		</P>
	</>
)

export const Multicol = () => (
	<Div
		{...{
			className: style.multicol,
		}}>
		<Div>
			<Lipsum />
		</Div>
		<Div>
			<Lipsum />
		</Div>
		<Div>
			<Lipsum />
		</Div>
		<Div>
			<Lipsum />
		</Div>
	</Div>
)
